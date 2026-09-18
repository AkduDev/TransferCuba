import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  createDeliveryReview,
  getDeliveryRequest,
  listDeliveryReviews,
  DbUnavailableError,
  InvalidReviewError,
  type ReviewErrorReason
} from '@/lib/db-delivery';
import { toDeliveryReviewDTO } from '@/lib/delivery-dto';
import { REVIEW_COMMENT_MAX } from '@/lib/delivery-client';
import type { PublicUser } from '@/lib/db-auth';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** El motivo del dominio decide el código; el DAO no sabe de HTTP. */
const REASON_TO_STATUS: Record<ReviewErrorReason, number> = {
  input: 400,
  ownership: 403,
  state: 403,
  duplicate: 409
};

/** Puede ver las valoraciones quien puede ver la carrera. */
async function puedeVer(deliveryId: string, user: PublicUser): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  const delivery = await getDeliveryRequest(deliveryId);
  if (!delivery) return false;
  return delivery.requester_id === user.id || delivery.messenger_id === user.id;
}

// GET /api/deliveries/[id]/reviews — valoraciones visibles de una carrera.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const { id } = await ctx.params;
  if (!UUID.test(id)) return err('Identificador de carrera inválido', 400);

  try {
    if (!(await puedeVer(id, auth.user))) return err('No tienes acceso a esta carrera', 403);
    // `hidden` y `removed` solo los ve administración.
    const reviews = await listDeliveryReviews(id, auth.user.role === 'ADMIN');
    return NextResponse.json({ success: true, reviews: reviews.map(toDeliveryReviewDTO) });
  } catch (error) {
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] GET /api/deliveries/[id]/reviews:', (error as Error)?.message ?? error);
    return err('No se pudieron cargar las valoraciones', 400);
  }
}

// POST /api/deliveries/[id]/reviews — solo el solicitante de una carrera
// DELIVERED, y una sola vez.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const { id } = await ctx.params;
  if (!UUID.test(id)) return err('Identificador de carrera inválido', 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido', 400);
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return err('La puntuación debe ser un entero de 1 a 5', 400);
  }

  const rawComment = typeof body.comment === 'string' ? body.comment.trim() : '';
  if (rawComment.length > REVIEW_COMMENT_MAX) {
    return err(`El comentario no puede superar ${REVIEW_COMMENT_MAX} caracteres`, 400);
  }
  // Un comentario vacío se guarda como NULL, no como cadena vacía.
  const comment = rawComment.length > 0 ? rawComment : null;

  try {
    const review = await createDeliveryReview({
      deliveryId: id,
      requesterId: auth.user.id,
      rating,
      comment
    });
    if (!review) return err('Carrera no encontrada', 404);
    return NextResponse.json({ success: true, review: toDeliveryReviewDTO(review) }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidReviewError) {
      return err(error.message, REASON_TO_STATUS[error.reason]);
    }
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] POST /api/deliveries/[id]/reviews:', (error as Error)?.message ?? error);
    return err('No se pudo registrar la valoración', 400);
  }
}
