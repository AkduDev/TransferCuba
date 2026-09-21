import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { presignPut } from '@/lib/r2';
import { getDbPool } from '@/lib/db-auth';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// POST /api/businesses/[id]/images — genera presigned URL para subir imagen a R2.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Autenticación requerida', auth.status);

  const { id: businessId } = await params;
  const body = await req.json().catch(() => null) as {
    fileName?: string;
    contentType?: string;
    fileSize?: number;
  } | null;

  if (!body?.fileName || !body?.contentType) {
    return err('fileName y contentType requeridos', 400);
  }

  if (!ALLOWED_TYPES.has(body.contentType)) {
    return err('Tipo de archivo no permitido (jpeg, png, webp, gif)', 400);
  }

  if (body.fileSize && body.fileSize > MAX_FILE_SIZE) {
    return err('El archivo no puede superar 5MB', 400);
  }

  const ext = body.fileName.split('.').pop() ?? 'jpg';
  const key = `businesses/${businessId}/${randomUUID()}.${ext}`;

  try {
    const { uploadUrl, publicUrl } = presignPut(key, body.contentType);

    // Guardar referencia en DB (status: pending hasta que se confirme la subida)
    const pool = getDbPool();
    if (pool) {
      await pool.query(
        `INSERT INTO business_images (id, business_id, url, alt, sort_order, is_cover)
         VALUES ($1, $2, $3, $4, 0, FALSE)`,
        [randomUUID(), businessId, publicUrl, body.fileName]
      );
    }

    return NextResponse.json({ success: true, uploadUrl, publicUrl, key });
  } catch (error) {
    const msg = (error as Error)?.message ?? '';
    if (msg.includes('R2 environment variables')) {
      return err('Almacenamiento no configurado', 503);
    }
    console.error('[api] POST images:', msg);
    return err('No se pudo generar la URL de subida', 500);
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
