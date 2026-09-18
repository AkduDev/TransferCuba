import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import {
  getPlatformConfig,
  updatePlatformConfig,
  DbUnavailableError,
  InvalidPricingError
} from '@/lib/db-delivery';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function requireAdmin(req: NextRequest) {
  if (!sessionValidFromRequest(req)) return err('Acceso de administrador requerido', 401);
  return null;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, platform: await getPlatformConfig() });
  } catch (error) {
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] GET /api/admin/platform:', (error as Error)?.message ?? error);
    return err('No se pudo cargar la configuración', 400);
  }
}

export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido', 400);
  }

  const messengerFeeCup =
    body.messengerFeeCup === undefined ? undefined : Number(body.messengerFeeCup);
  const messengerPayCard =
    body.messengerPayCard === undefined ? undefined : String(body.messengerPayCard ?? '').trim();
  const messengerWhatsapp =
    body.messengerWhatsapp === undefined ? undefined : String(body.messengerWhatsapp ?? '').trim();
  const messengerPeriodDays =
    body.messengerPeriodDays === undefined ? undefined : Number(body.messengerPeriodDays);

  if (
    messengerFeeCup !== undefined &&
    (!Number.isFinite(messengerFeeCup) || messengerFeeCup < 0)
  ) {
    return err('La tarifa de alta debe ser un número positivo', 400);
  }
  if (
    messengerPeriodDays !== undefined &&
    (!Number.isInteger(messengerPeriodDays) || messengerPeriodDays < 1 || messengerPeriodDays > 365)
  ) {
    return err('El periodo de validez debe ser un entero entre 1 y 365 días', 400);
  }
  if (
    (messengerPayCard !== undefined && messengerPayCard.length > 80) ||
    (messengerWhatsapp !== undefined && messengerWhatsapp.length > 80)
  ) {
    return err('Los datos de pago no pueden superar 80 caracteres', 400);
  }

  try {
    const platform = await updatePlatformConfig(
      {
        ...(messengerFeeCup !== undefined ? { messengerFeeCup } : {}),
        ...(messengerPayCard !== undefined ? { messengerPayCard } : {}),
        ...(messengerWhatsapp !== undefined ? { messengerWhatsapp } : {}),
        ...(messengerPeriodDays !== undefined ? { messengerPeriodDays } : {})
      },
      null
    );
    return NextResponse.json({ success: true, platform });
  } catch (error) {
    if (error instanceof InvalidPricingError) return err(error.message, 400);
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] PATCH /api/admin/platform:', (error as Error)?.message ?? error);
    return err('No se pudo actualizar la configuración', 400);
  }
}
