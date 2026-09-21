import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { deleteAsset, publicIdFromUrl } from '@/lib/cloudinary';
import { getDbPool } from '@/lib/db-auth';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// DELETE /api/businesses/[id]/images/[imageId] — borrar imagen (admin).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const isAdmin = sessionValidFromRequest(req);
  if (!isAdmin) {
    const auth = await requireAuth(req);
    if (!auth.ok) return err('Autenticación requerida', auth.status);
  }

  const { id: businessId, imageId } = await params;

  const pool = getDbPool();
  if (!pool) return err('Base de datos no disponible', 503);

  try {
    const imgRes = await pool.query(
      `SELECT id, url FROM business_images WHERE id = $1 AND business_id = $2`,
      [imageId, businessId]
    );

    if (imgRes.rows.length === 0) {
      return err('Imagen no encontrada', 404);
    }

    const img = imgRes.rows[0] as { id: string; url: string };

    // Borrar de Cloudinary (ignorar si no hay API keys configuradas)
    try {
      const publicId = publicIdFromUrl(img.url);
      if (publicId) {
        await deleteAsset(publicId);
      }
    } catch {
      // Continuar aunque falle el borrado de Cloudinary
    }

    await pool.query(`DELETE FROM business_images WHERE id = $1`, [imageId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api] DELETE image:', (error as Error)?.message ?? error);
    return err('No se pudo borrar la imagen', 500);
  }
}
