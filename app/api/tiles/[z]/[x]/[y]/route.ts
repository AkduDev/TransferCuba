import { NextRequest } from 'next/server';
import { queryBusinessesMvt } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MVT_CONTENT_TYPE = 'application/vnd.mapbox-vector-tile';

// `max-age` es para el navegador: sin él la cabecera que llega al cliente es
// solo `public`, sin TTL, y volver a una zona ya vista puede tocar la red otra
// vez. Se queda corto a propósito (5 min) porque una vez servida no hay forma
// de purgarla. `s-maxage` sí puede ser largo: los negocios solo cambian cuando
// un administrador aprueba uno, y `stale-while-revalidate` evita que nadie
// espere a la revalidación.
const CACHE_TESELAS = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

const CABECERAS_MVT = {
  'Content-Type': MVT_CONTENT_TYPE,
  'Cache-Control': CACHE_TESELAS
};

// GET /api/tiles/[z]/[x]/[y] — vector tile MVT de negocios activos.
// Sprint 5 / Fase 4 (ver db/schema.sql → get_businesses_mvt). Público y
// cacheable: ver CACHE_TESELAS.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z: zRaw, x: xRaw, y: yRaw } = await params;

  const z = Number(zRaw);
  const x = Number(xRaw);
  const y = Number(yRaw);

  const isUnsignedInt = (n: number) => Number.isInteger(n) && n >= 0;
  if (!isUnsignedInt(z) || !isUnsignedInt(x) || !isUnsignedInt(y)) {
    return new Response('tile coordinates must be non-negative integers', {
      status: 400
    });
  }

  // Los tiles Web Mercator solo existen hasta z22 (SLD); más allá no hay datos.
  const MAX_ZOOM = 22;
  const maxTiles = 2 ** z;
  if (z > MAX_ZOOM || x >= maxTiles || y >= maxTiles) {
    return new Response('tile out of range', { status: 400 });
  }

  try {
    const mvt = await queryBusinessesMvt(z, x, y);
    if (mvt === null) {
      // Tile vacío (zona sin negocios / fallback in-memory): válido, no error.
      return new Response(new Uint8Array(0), { headers: CABECERAS_MVT });
    }
    return new Response(new Uint8Array(mvt), { headers: CABECERAS_MVT });
  } catch (err) {
    console.error('[api] error en GET /api/tiles:', (err as Error)?.message ?? err);
    return new Response('Servicio temporalmente no disponible', { status: 503 });
  }
}