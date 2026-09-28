import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { requestPlan, InvalidPlanError } from '@/lib/db-plans';
import { toPlanPaymentDTO } from '@/lib/plans-dto';
import { isPaymentMethod, isPlanCode, referenceFor } from '@/lib/plans-validate';
import { isBusinessId } from '@/lib/ownership-validate';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// POST /api/plans/[code]/subscribe — pedir un plan.
// No lo activa: deja un pago pendiente que confirma el administrador.
export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const { code } = await ctx.params;
  if (!isPlanCode(code)) return err('Plan inválido', 400);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('JSON inválido', 400);
  }

  if (!isPaymentMethod(body.method)) {
    return err('Forma de pago inválida: usa efectivo o transferencia', 400);
  }
  const referencia = referenceFor(body.method, body.reference);
  if (!referencia.ok) return err(referencia.error, 400);

  const businessId =
    body.businessId === undefined || body.businessId === null ? null : body.businessId;
  if (businessId !== null && !isBusinessId(businessId)) {
    return err('Identificador de negocio inválido', 400);
  }

  try {
    const { payment } = await requestPlan({
      userId: auth.user.id,
      planCode: code,
      businessId,
      method: body.method,
      reference: referencia.value
    });
    return NextResponse.json(
      { success: true, payment: toPlanPaymentDTO(payment) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof InvalidPlanError) {
      if (error.reason === 'not_found') return err(error.message, 404);
      if (error.reason === 'ownership') return err(error.message, 403);
      if (error.reason === 'scope') return err(error.message, 400);
      return err(error.message, 409);
    }
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] POST /api/plans/[code]/subscribe:', (error as Error)?.message ?? error);
    return err('No se pudo registrar la solicitud', 400);
  }
}
