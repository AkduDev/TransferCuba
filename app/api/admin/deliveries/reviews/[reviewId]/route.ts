import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import {
  updateDeliveryReviewStatus,
  DbUnavailableError,
  type ReviewModerationAction
} from '@/lib/db-delivery';
import { toDeliveryReviewDTO } from '@/lib/delivery-dto';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS: ReviewModerationAction[] = ['hide', 'restore', 'remove'];

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// PATCH /api/admin/deliveries/reviews/[reviewId] — moderación.
// `remove` cambia el estado lógico; la fila se conserva para auditoría.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ reviewId: string }> }) {
  if (!sessionValidFromRequest(req)) return err('Acceso de administrador requerido', 401);

  const { reviewId } = await ctx.params;
  if (!UUID.test(reviewId)) return err('Identificador de valoración inválido', 400);

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido', 400);
  }
  if (!ACTIONS.includes(body.action as ReviewModerationAction)) {
    return err('Acción no válida: hide, restore o remove', 400);
  }

  try {
    const review = await updateDeliveryReviewStatus(reviewId, body.action as ReviewModerationAction);
    if (!review) return err('Valoración no encontrada', 404);
    return NextResponse.json({ success: true, review: toDeliveryReviewDTO(review) });
  } catch (error) {
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] PATCH /api/admin/deliveries/reviews/[reviewId]:', (error as Error)?.message ?? error);
    return err('No se pudo moderar la valoración', 400);
  }
}
