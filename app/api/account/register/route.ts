import { NextRequest, NextResponse } from 'next/server';
import {
  createSession,
  createUser,
  findUserByPhone,
  normalizePhone,
  toPublicUser,
  DbUnavailableError
} from '@/lib/db-auth';
import { authCookie, hashPin, isValidName, isValidPin } from '@/lib/auth';
import { createMessengerApplication } from '@/lib/db-delivery';

export const dynamic = 'force-dynamic';

// POST /api/account/register — alta de usuario con teléfono + PIN.
// Si wantsToBeMessenger es true, también crea perfil de mensajero y pago pendiente.
// Emite sesión en cookie HttpOnly al completar el registro.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  const wantsToBeMessenger = body.wantsToBeMessenger === true;

  if (!phone) {
    return NextResponse.json(
      { success: false, error: 'Teléfono inválido (7 a 15 dígitos)' },
      { status: 400 }
    );
  }
  if (!isValidName(name)) {
    return NextResponse.json(
      { success: false, error: 'Nombre requerido (mínimo 3 caracteres)' },
      { status: 400 }
    );
  }
  if (!isValidPin(pin)) {
    return NextResponse.json(
      { success: false, error: 'PIN inválido (4 a 8 dígitos)' },
      { status: 400 }
    );
  }

  try {
    const existing = await findUserByPhone(phone);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ese teléfono ya está registrado' },
        { status: 409 }
      );
    }

    const user = await createUser({ phone, name, pinHash: hashPin(pin) });

    if (wantsToBeMessenger) {
      try {
        await createMessengerApplication({
          userId: user.id,
          vehicle: '',
          serviceAreas: [],
          reference: '',
          method: 'transferencia'
        });
      } catch {
        console.error('[api/register] No se pudo crear perfil de mensajero pendiente');
      }
    }

    const session = await createSession(user.id);
    const cookie = authCookie(session.id);

    const res = NextResponse.json(
      { success: true, user: toPublicUser(user), wantsToBeMessenger },
      { status: 201 }
    );
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Ese teléfono ya está registrado' },
        { status: 409 }
      );
    }
    if (err instanceof DbUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente no disponible' },
        { status: 503 }
      );
    }
    console.error('[api] error en POST /api/account/register:', (err as Error)?.message ?? err);
    return NextResponse.json({ success: false, error: 'Registro fallido' }, { status: 400 });
  }
}
