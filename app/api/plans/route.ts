import { NextResponse } from 'next/server';
import { DbUnavailableError } from '@/lib/db-auth';
import { listPlans } from '@/lib/db-plans';
import { toPlanDTO } from '@/lib/plans-dto';

export const dynamic = 'force-dynamic';

// GET /api/plans — catálogo público: qué planes hay y cuánto cuestan.
//
// TTL corto a propósito: el precio lo cambia el administrador desde el panel y
// enseñar uno viejo confundiría. Aun así el importe real se congela en el
// servidor al pedirlo, así que la caché nunca decide lo que se cobra.
export async function GET() {
  try {
    const planes = await listPlans(true);
    return NextResponse.json(
      { success: true, plans: planes.map(toPlanDTO) },
      { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente no disponible' },
        { status: 503 }
      );
    }
    console.error('[api] GET /api/plans:', (error as Error)?.message ?? error);
    return NextResponse.json({ success: false, error: 'No se pudo cargar' }, { status: 400 });
  }
}
