import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { reviewPlanPayment, InvalidPlanError } from '@/lib/db-plans';
import { toPlanPaymentDTO } from '@/lib/plans-dto';
import { isPlanReviewAction } from '@/lib/plans-validate';
import { isUuid } from '@/lib/ownership-validate';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// PATCH /api/admin/plan-payments/[paymentId] — confirmar o rechazar un pago.
// Confirmar activa la suscripción y suma el periodo a lo que quedara.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ paymentId: string }> }) {
  if (!sessionValidFromRequest(req)) return err('Acceso de administrador requerido', 401);

  const { paymentId } = await ctx.params;
  if (!isUuid(paymentId)) return err('Identificador de pago inválido', 400);

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido', 400);
  }
  if (!isPlanReviewAction(body.action)) return err('Acción no válida: usa confirm o reject', 400);

  try {
    const pago = await reviewPlanPayment({ paymentId, action: body.action, adminUserId: null });
    return NextResponse.json({
      success: true,
      payment: toPlanPaymentDTO(pago, { includePayer: true, includePlan: true })
    });
  } catch (error) {
    if (error instanceof InvalidPlanError) {
      return err(error.message, error.reason === 'not_found' ? 404 : 409);
    }
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] PATCH /api/admin/plan-payments/[paymentId]:', (error as Error)?.message ?? error);
    return err('No se pudo procesar el pago', 400);
  }
}
