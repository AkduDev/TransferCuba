import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { reviewClaim, InvalidOwnershipClaimError } from '@/lib/db-ownership';
import { toOwnershipClaimDTO } from '@/lib/ownership-dto';
import { isClaimAction, isUuid } from '@/lib/ownership-validate';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// PATCH /api/admin/business-claims/[claimId] — confirmar o rechazar.
//
// `reviewed_by` va en NULL igual que en la revisión de mensajeros: la sesión de
// administración es usuario/contraseña de plataforma y no se corresponde con
// una fila de `users`, así que no hay id que anotar sin inventarlo.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ claimId: string }> }) {
  if (!sessionValidFromRequest(req)) {
    return err('Acceso de administrador requerido', 401);
  }

  const { claimId } = await ctx.params;
  if (!isUuid(claimId)) return err('Identificador de solicitud inválido', 400);

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido', 400);
  }
  if (!isClaimAction(body.action)) {
    return err('Acción no válida: usa confirm o reject', 400);
  }

  try {
    const claim = await reviewClaim({ claimId, action: body.action, adminUserId: null });
    return NextResponse.json({
      success: true,
      claim: toOwnershipClaimDTO(claim, { includeBusiness: true, includeClaimant: true })
    });
  } catch (error) {
    if (error instanceof InvalidOwnershipClaimError) {
      return err(error.message, error.reason === 'not_found' ? 404 : 409);
    }
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error(
      '[api] PATCH /api/admin/business-claims/[claimId]:',
      (error as Error)?.message ?? error
    );
    return err('No se pudo procesar la solicitud', 400);
  }
}
