import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db-auth';
import { randomUUID } from 'node:crypto';
import { activeFeaturesForBusiness } from '@/lib/db-plans';
import { limiteDeFotos } from '@/lib/plans-validate';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// POST /api/businesses/[id]/images — guarda la URL de la imagen subida a Cloudinary.
// La subida real la hace el cliente directamente a Cloudinary (unsigned upload).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Autenticación requerida', auth.status);

  const { id: businessId } = await params;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID.test(businessId)) {
    return err('Identificador de negocio inválido', 400);
  }
  const body = await req.json().catch(() => null) as {
    url?: string;
    publicId?: string;
    alt?: string;
  } | null;

  if (!body?.url || !body?.publicId) {
    return err('url y publicId requeridos', 400);
  }

  // Solo HTTPS de Cloudinary; publicId con formato de asset y alt acotado
  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return err('URL no válida', 400);
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' || body.url.length > 500) {
    return err('URL no válida', 400);
  }
  if (!/^[A-Za-z0-9/_-]+$/.test(body.publicId) || body.publicId.length > 200) {
    return err('publicId no válido', 400);
  }
  const alt = typeof body.alt === 'string' ? body.alt.trim().slice(0, 200) : null;

  const pool = getDbPool();
  if (!pool) return err('Base de datos no disponible', 503);

  try {
    // Solo el dueño confirmado. Antes bastaba con tener cuenta, así que
    // cualquiera podía colgar fotos en el negocio de otro.
    const duenoRes = await pool.query(
      'SELECT 1 FROM businesses WHERE id = $1 AND owner_user_id = $2',
      [businessId, auth.user.id]
    );
    if (!duenoRes.rowCount) return err('Ese negocio no es tuyo', 403);

    // El tope depende de lo que tenga desbloqueado, no de su rol.
    const [features, actuales] = await Promise.all([
      activeFeaturesForBusiness(businessId),
      pool.query<{ n: string }>(
        'SELECT count(*)::int AS n FROM business_images WHERE business_id = $1',
        [businessId]
      )
    ]);
    const tope = limiteDeFotos(features);
    if (Number(actuales.rows[0]?.n ?? 0) >= tope) {
      return err(
        `Has llegado al límite de ${tope} fotos. Con un plan premium puedes subir más.`,
        409
      );
    }

    await pool.query(
      `INSERT INTO business_images (id, business_id, url, alt, sort_order, is_cover)
       VALUES ($1, $2, $3, $4, 0, FALSE)`,
      [randomUUID(), businessId, body.url, alt]
    );
    return NextResponse.json({ success: true, remaining: tope - Number(actuales.rows[0]?.n ?? 0) - 1 });
  } catch (error) {
    console.error('[api] POST images:', (error as Error)?.message ?? error);
    return err('No se pudo guardar la imagen', 500);
  }
}

// GET /api/businesses/[id]/images — lista imágenes del negocio.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ success: true, images: [] });
  }

  try {
    const res = await pool.query(
      `SELECT id, url, thumbnail_url, alt, sort_order, is_cover
       FROM business_images WHERE business_id = $1 ORDER BY sort_order`,
      [businessId]
    );
    return NextResponse.json({ success: true, images: res.rows });
  } catch {
    return NextResponse.json({ success: true, images: [] });
  }
}
