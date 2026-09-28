import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { listBusinessesOfUser } from '@/lib/db-ownership';
import { toOwnedBusinessDTO } from '@/lib/ownership-dto';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// GET /api/account/businesses — los negocios de quien pregunta: los que ya son
// suyos y los que ha reclamado sin resolver.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  try {
    const filas = await listBusinessesOfUser(auth.user.id);
    return NextResponse.json(
      { success: true, businesses: filas.map(toOwnedBusinessDTO) },
      // Depende de la sesión: nunca en una caché compartida.
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] GET /api/account/businesses:', (error as Error)?.message ?? error);
    return err('No se pudieron cargar tus negocios', 400);
  }
}
