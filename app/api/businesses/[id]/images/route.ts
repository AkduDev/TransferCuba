import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db-auth';
import { randomUUID } from 'node:crypto';

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
  const body = await req.json().catch(() => null) as {
    url?: string;
    publicId?: string;
    alt?: string;
  } | null;

  if (!body?.url || !body?.publicId) {
    return err('url y publicId requeridos', 400);
  }

  // Validar que la URL es de Cloudinary
  if (!body.url.includes('res.cloudinary.com')) {
    return err('URL no válida', 400);
  }

  const pool = getDbPool();
  if (!pool) return err('Base de datos no disponible', 503);

  try {
    await pool.query(
      `INSERT INTO business_images (id, business_id, url, alt, sort_order, is_cover)
       VALUES ($1, $2, $3, $4, 0, FALSE)`,
      [randomUUID(), businessId, body.url, body.alt ?? null]
    );
    return NextResponse.json({ success: true });
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
