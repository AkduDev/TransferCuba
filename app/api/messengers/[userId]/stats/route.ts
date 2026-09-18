import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getMessengerStats, DbUnavailableError } from '@/lib/db-delivery';
import { toMessengerStatsDTO } from '@/lib/delivery-dto';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// GET /api/messengers/[userId]/stats — rendimiento del mensajero.
// Solo el propio mensajero o administración: el rendimiento de un tercero no
// es información pública.
export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const { userId } = await ctx.params;
  if (!UUID.test(userId)) return err('Identificador de usuario inválido', 400);

  if (auth.user.role !== 'ADMIN' && auth.user.id !== userId) {
    return err('No tienes acceso a estas estadísticas', 403);
  }

  try {
    const stats = await getMessengerStats(userId);
    return NextResponse.json({ success: true, stats: toMessengerStatsDTO(stats) });
  } catch (error) {
    if (error instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] GET /api/messengers/[userId]/stats:', (error as Error)?.message ?? error);
    return err('No se pudieron cargar las estadísticas', 400);
  }
}
