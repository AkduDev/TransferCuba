import { NextRequest, NextResponse } from 'next/server';
import {
  createSession,
  findUserByPhone,
  normalizePhone,
  toPublicUser,
  touchLastLogin,
  DbUnavailableError
} from '@/lib/db-auth';
import { authCookie, verifyPin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/account/login — sesión de usuario (teléfono + PIN).
// Mensaje de error genérico: no revela si el teléfono existe.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '');
  const pin = typeof body.pin === 'string' ? body.pin : '';

  if (!phone || !pin) {
    return NextResponse.json(
      { success: false, error: 'Teléfono y PIN requeridos' },
      { status: 400 }
    );
  }

  try {
    const user = await findUserByPhone(phone);
    if (!user || !verifyPin(pin, user.pin_hash)) {
      return NextResponse.json(
        { success: false, error: 'Teléfono o PIN incorrectos' },
        { status: 401 }
      );
    }
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Cuenta bloqueada. Contacta al administrador.' },
        { status: 403 }
      );
    }

    await touchLastLogin(user.id);
    const session = await createSession(user.id);
    const cookie = authCookie(session.id);

    const res = NextResponse.json({ success: true, user: toPublicUser(user) });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (err) {
    if (err instanceof DbUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente no disponible' },
        { status: 503 }
      );
    }
    console.error('[api] error en POST /api/account/login:', (err as Error)?.message ?? err);
    return NextResponse.json({ success: false, error: 'Login fallido' }, { status: 400 });
  }
}
