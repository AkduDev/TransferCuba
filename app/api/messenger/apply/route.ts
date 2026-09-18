import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  createMessengerApplication,
  getMessengerProfile,
  getPlatformConfig,
  listMessengerPayments,
  DbUnavailableError,
  InvalidMessengerApplicationError,
  type MessengerPaymentRow,
  type MessengerProfileRow
} from '@/lib/db-delivery';

export const dynamic = 'force-dynamic';

const VEHICLES = ['pie', 'bicicleta', 'moto', 'auto', 'otro'] as const;

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function mapProfile(profile: MessengerProfileRow | null) {
  if (!profile) return null;
  return {
    id: profile.id,
    userId: profile.user_id,
    vehicle: profile.vehicle,
    serviceAreas: profile.service_areas,
    status: profile.status,
    activeSince: profile.active_since?.toISOString() ?? null,
    createdAt: profile.created_at.toISOString()
  };
}

function mapPayment(payment: MessengerPaymentRow) {
  return {
    id: payment.id,
    amountCup: Number(payment.amount_cup),
    status: payment.status,
    reference: payment.reference,
    evidenceNote: payment.evidence_note,
    createdAt: payment.created_at.toISOString()
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  try {
    const [platform, profile, payments] = await Promise.all([
      getPlatformConfig(),
      getMessengerProfile(auth.user.id),
      listMessengerPayments(auth.user.id)
    ]);
    return NextResponse.json({
      success: true,
      platform,
      profile: mapProfile(profile),
      payments: payments.map(mapPayment),
      applicationOpen: !profile || profile.status !== 'ACTIVE',
      isMessenger: auth.user.role === 'MESSENGER'
    });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] GET /api/messenger/apply:', (error as Error)?.message ?? error);
    return err('No se pudo cargar la solicitud', 400);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);
  if (auth.user.role === 'MESSENGER') return err('Tu cuenta ya es de mensajero', 409);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido', 400);
  }

  const vehicle = typeof body.vehicle === 'string' ? body.vehicle : '';
  const rawAreas = body.serviceAreas;
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const serviceAreas = Array.isArray(rawAreas)
    ? rawAreas
        .filter((area): area is string => typeof area === 'string')
        .map((area) => area.trim())
        .filter(Boolean)
    : [];

  if (!VEHICLES.includes(vehicle as (typeof VEHICLES)[number])) {
    return err('Medio de transporte inválido', 400);
  }
  if (serviceAreas.length === 0 || serviceAreas.length > 8 || serviceAreas.some((area) => area.length > 80)) {
    return err('Selecciona entre 1 y 8 zonas de servicio válidas', 400);
  }
  if (reference.length < 3 || reference.length > 80) {
    return err('La referencia del pago debe tener entre 3 y 80 caracteres', 400);
  }

  try {
    const result = await createMessengerApplication({
      userId: auth.user.id,
      vehicle,
      serviceAreas,
      reference
    });
    return NextResponse.json(
      {
        success: true,
        profile: mapProfile(result.profile),
        payment: mapPayment(result.payment)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof InvalidMessengerApplicationError) {
      return err(error.message, 409);
    }
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] POST /api/messenger/apply:', (error as Error)?.message ?? error);
    return err('No se pudo crear la solicitud', 400);
  }
}
