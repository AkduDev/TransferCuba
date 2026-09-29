import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { siteVisitStats } from '@/lib/db-stats';

export const dynamic = 'force-dynamic';

// GET /api/admin/visits — visitas de los últimos 30 días, por día y ruta.
export async function GET(req: NextRequest) {
  if (!sessionValidFromRequest(req)) {
    return NextResponse.json(
      { success: false, error: 'Acceso de administrador requerido' },
      { status: 401 }
    );
  }
  try {
    const { total, series } = await siteVisitStats(30);
    return NextResponse.json(
      { success: true, total, series },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente no disponible' },
        { status: 503 }
      );
    }
    console.error('[api] GET /api/admin/visits:', (error as Error)?.message ?? error);
    return NextResponse.json({ success: false, error: 'No se pudo cargar' }, { status: 400 });
  }
}
