import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { listPendingClaims } from '@/lib/db-ownership';
import { toOwnershipClaimDTO } from '@/lib/ownership-dto';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// GET /api/admin/business-claims — cola de solicitudes de propiedad sin
// resolver, la más antigua primero.
export async function GET(req: NextRequest) {
  if (!sessionValidFromRequest(req)) {
    return err('Acceso de administrador requerido', 401);
  }

  try {
    const filas = await listPendingClaims();
    return NextResponse.json(
      {
        success: true,
        claims: filas.map((f) =>
          toOwnershipClaimDTO(f, { includeBusiness: true, includeClaimant: true })
        )
      },
      // Lleva el teléfono de quien reclama: jamás en una caché compartida.
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] GET /api/admin/business-claims:', (error as Error)?.message ?? error);
    return err('No se pudieron cargar las solicitudes', 400);
  }
}
