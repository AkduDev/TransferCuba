import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import {
  reviewMessengerApplication,
  DbUnavailableError,
  InvalidMessengerApplicationError,
  type MessengerReviewAction
} from '@/lib/db-delivery';

export const dynamic = 'force-dynamic';

const ACTIONS: MessengerReviewAction[] = ['confirm', 'reject', 'suspend', 'activate'];

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  if (!sessionValidFromRequest(req)) {
    return err('Acceso de administrador requerido', 401);
  }

  const { userId } = await ctx.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return err('Identificador de usuario inválido', 400);
  }

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido', 400);
  }
  if (!ACTIONS.includes(body.action as MessengerReviewAction)) {
    return err('Acción no válida', 400);
  }

  try {
    const application = await reviewMessengerApplication(userId, body.action as MessengerReviewAction, null);
    if (!application) return err('Solicitud de mensajería no encontrada', 404);
    return NextResponse.json({ success: true, application });
  } catch (error) {
    if (error instanceof InvalidMessengerApplicationError) {
      return err(error.message, error.message.includes('no encontrada') ? 404 : 409);
    }
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] PATCH /api/admin/messengers/[userId]:', (error as Error)?.message ?? error);
    return err('No se pudo procesar la solicitud', 400);
  }
}
