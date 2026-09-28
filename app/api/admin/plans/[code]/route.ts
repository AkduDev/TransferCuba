import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { updatePlan, InvalidPlanError } from '@/lib/db-plans';
import { toPlanDTO } from '@/lib/plans-dto';
import { isPlanCode, toPeriodDays, toPriceCup } from '@/lib/plans-validate';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// PATCH /api/admin/plans/[code] — cambiar precio, periodo, nombre o disponibilidad.
//
// Lo que ya se pidió NO cambia: el importe y el periodo se congelaron en la
// fila del pago al solicitarlo.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  if (!sessionValidFromRequest(req)) return err('Acceso de administrador requerido', 401);

  const { code } = await ctx.params;
  if (!isPlanCode(code)) return err('Plan inválido', 400);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('JSON inválido', 400);
  }

  const cambios: { priceCup?: number; periodDays?: number; active?: boolean; name?: string } = {};

  if (body.priceCup !== undefined) {
    const precio = toPriceCup(body.priceCup);
    if (precio === null) return err('El precio debe ser un número mayor que cero', 400);
    cambios.priceCup = precio;
  }
  if (body.periodDays !== undefined) {
    const dias = toPeriodDays(body.periodDays);
    if (dias === null) return err('El periodo debe ser un entero entre 1 y 365 días', 400);
    cambios.periodDays = dias;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') return err('«active» debe ser verdadero o falso', 400);
    cambios.active = body.active;
  }
  if (body.name !== undefined) {
    const nombre = typeof body.name === 'string' ? body.name.trim() : '';
    if (nombre.length < 3 || nombre.length > 60) {
      return err('El nombre del plan debe tener entre 3 y 60 caracteres', 400);
    }
    cambios.name = nombre;
  }

  if (Object.keys(cambios).length === 0) return err('No hay nada que cambiar', 400);

  try {
    const plan = await updatePlan(code, cambios);
    return NextResponse.json({ success: true, plan: toPlanDTO(plan) });
  } catch (error) {
    if (error instanceof InvalidPlanError) {
      return err(error.message, error.reason === 'not_found' ? 404 : 409);
    }
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] PATCH /api/admin/plans/[code]:', (error as Error)?.message ?? error);
    return err('No se pudo actualizar el plan', 400);
  }
}
