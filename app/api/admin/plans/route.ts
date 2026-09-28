import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { listPlans } from '@/lib/db-plans';
import { toPlanDTO } from '@/lib/plans-dto';

export const dynamic = 'force-dynamic';

// GET /api/admin/plans — incluye los desactivados, que el catálogo público no.
export async function GET(req: NextRequest) {
  if (!sessionValidFromRequest(req)) {
    return NextResponse.json({ success: false, error: 'Acceso de administrador requerido' }, { status: 401 });
  }
  try {
    const planes = await listPlans(false);
    return NextResponse.json(
      { success: true, plans: planes.map(toPlanDTO) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return NextResponse.json({ success: false, error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    console.error('[api] GET /api/admin/plans:', (error as Error)?.message ?? error);
    return NextResponse.json({ success: false, error: 'No se pudo cargar' }, { status: 400 });
  }
}
