import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DbUnavailableError, getDbPool } from '@/lib/db-auth';
import { activeFeaturesForBusiness } from '@/lib/db-plans';
import { businessViewStats } from '@/lib/db-stats';
import { isBusinessId } from '@/lib/ownership-validate';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// GET /api/businesses/[id]/stats — visitas del negocio, solo para su dueño y
// solo si tiene desbloqueada la función. Se comprueba contra las suscripciones,
// nunca contra `users.role`.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const { id } = await ctx.params;
  if (!isBusinessId(id)) return err('Identificador inválido', 400);

  const pool = getDbPool();
  if (!pool) return err('Servicio temporalmente no disponible', 503);

  try {
    const dueno = await pool.query('SELECT 1 FROM businesses WHERE id = $1 AND owner_user_id = $2', [
      id,
      auth.user.id
    ]);
    if (!dueno.rowCount) return err('Ese negocio no es tuyo', 403);

    const features = await activeFeaturesForBusiness(id);
    if (!features.includes('stats')) {
      return err('Las estadísticas vienen con la cuenta premium', 402);
    }

    const { total, series } = await businessViewStats(id, 30);
    return NextResponse.json(
      { success: true, total, series },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] GET /api/businesses/[id]/stats:', (error as Error)?.message ?? error);
    return err('No se pudieron cargar las estadísticas', 400);
  }
}
