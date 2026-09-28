import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { claimBusiness, InvalidOwnershipClaimError } from '@/lib/db-ownership';
import { toOwnershipClaimDTO } from '@/lib/ownership-dto';
import { isBusinessId, toEvidence } from '@/lib/ownership-validate';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// POST /api/businesses/[id]/claim — reclamar la propiedad de un negocio.
// No cambia el negocio: deja una solicitud que un administrador confirma a
// mano, porque cualquiera podría escribir que un local es suyo.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const { id } = await ctx.params;
  if (!isBusinessId(id)) return err('Identificador de negocio inválido', 400);

  // El cuerpo es opcional: reclamar sin adjuntar nada es válido.
  let body: Record<string, unknown> = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const evidence = toEvidence(body.evidence);
  if (evidence === undefined) {
    return err('La evidencia debe ser texto de 500 caracteres como máximo', 400);
  }

  try {
    const claim = await claimBusiness({ businessId: id, userId: auth.user.id, evidence });
    return NextResponse.json({ success: true, claim: toOwnershipClaimDTO(claim) }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidOwnershipClaimError) {
      return err(error.message, error.reason === 'not_found' ? 404 : 409);
    }
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] POST /api/businesses/[id]/claim:', (error as Error)?.message ?? error);
    return err('No se pudo registrar la solicitud', 400);
  }
}
