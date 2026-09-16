import { NextRequest } from 'next/server';
import { queryBusinessesMvt } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MVT_CONTENT_TYPE = 'application/vnd.mapbox-vector-tile';

// GET /api/tiles/[z]/[x]/[y] — vector tile MVT de negocios activos.
// Sprint 5 / Fase 4 (ver db/schema.sql → get_businesses_mvt). Cachea en la
// CDN de Vercel en background: tiles públicos, refresco por revalidation.
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
      return new Response(new Uint8Array(0), {
        headers: {
          'Content-Type': MVT_CONTENT_TYPE,
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
        }
      });
    }
    return new Response(new Uint8Array(mvt), {
      headers: {
        'Content-Type': MVT_CONTENT_TYPE,
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
      }
    });
  } catch (err) {
    console.error('[api] error en GET /api/tiles:', (err as Error)?.message ?? err);
    return new Response('Servicio temporalmente no disponible', { status: 503 });
  }
}