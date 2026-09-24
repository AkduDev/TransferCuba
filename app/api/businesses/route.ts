import { NextRequest, NextResponse } from 'next/server';
import { queryBusinesses, queryBusinessesMap, insertBusiness, patchBusiness, PatchAction } from '@/lib/db';
import { Business } from '@/lib/cuba-data';
import { sessionValidFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// Sprint 5 (Cuba-first): sin fotos → placeholder local SVG por categoría
// (BusinessCover). No se tocan CDNs externos (lentos/inaccesibles en Cuba).
//
// El POST es PÚBLICO, así que antes se podía mandar cualquier URL como foto:
// una lista negra de cuatro bancos de imágenes dejaba pasar todo lo demás y la
// ficha acababa con una foto que nunca se pintaría, porque `next/image` solo
// acepta los hosts de `remotePatterns`. Ahora es lista blanca, y la única
// entrada es la misma que declara next.config.ts.
const ALLOWED_PHOTO_HOST = 'res.cloudinary.com';

function isAllowedPhotoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === ALLOWED_PHOTO_HOST;
  } catch {
    return false;
  }
}

const sanitizePhotos = (photos: unknown): string[] =>
  Array.isArray(photos) ? photos.filter(isAllowedPhotoUrl) : [];

// GET /api/businesses — filtros + spatial queries (viewport bbox / nearby).
// Sprint 2: PostGIS con ST_MakeEnvelope && / ST_DWithin / ST_Distance;
// sin DATABASE_URL cae al fallback in-memory (dev).
// includeAll=true (ver/rechazar/borrar pendientes) exige sesión admin.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get('includeAll') === 'true';

  if (includeAll && !sessionValidFromRequest(req)) {
    return NextResponse.json(
      { success: false, error: 'Sesión de administración requerida' },
      { status: 401 }
    );
  }

  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const radiusParam = searchParams.get('radius');
  const bboxParam = searchParams.get('bbox'); // w,s,e,n

  let bbox: [number, number, number, number] | undefined;
  if (bboxParam) {
    const parts = bboxParam.split(',').map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      bbox = parts as [number, number, number, number];
    } else {
      return NextResponse.json({ success: false, error: 'bbox inválido (w,s,e,n)' }, { status: 400 });
    }
  }

  const lat = latParam ? parseFloat(latParam) : undefined;
  const lng = lngParam ? parseFloat(lngParam) : undefined;
  if (lat !== undefined && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
    return NextResponse.json({ success: false, error: 'lat inválida' }, { status: 400 });
  }
  if (lng !== undefined && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
    return NextResponse.json({ success: false, error: 'lng inválida' }, { status: 400 });
  }

  const mapMode = searchParams.get('map') === 'true';

  try {
    const results = await (mapMode ? queryBusinessesMap : queryBusinesses)({
      bbox,
      lat,
      lng,
      radius: radiusParam ? parseFloat(radiusParam) : undefined,
      province: searchParams.get('province') ?? undefined,
      municipality: searchParams.get('municipality') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      onlyTransfer: searchParams.get('transfer') === 'true',
      activeNow: searchParams.get('activeNow') === 'true',
      qr: searchParams.get('qr') === 'true',
      online: searchParams.get('online') === 'true',
      includeAll,
      verification: (searchParams.get('verification') as 'verified' | 'pending' | 'reported' | 'all' | null) ?? undefined,
      q: searchParams.get('q') ?? undefined,
      limit: Math.min(parseInt(searchParams.get('limit') ?? '500', 10) || 500, 500)
    });

    return NextResponse.json(
      { success: true, total: results.length, businesses: results },
      {
        headers: {
          // Vercel edge cache: barato para el viewport, refresca en background
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
      }
    );
  } catch (err) {
    console.error('[api] error en GET /api/businesses:', (err as Error)?.message ?? err);
    return NextResponse.json(
      { success: false, error: 'Servicio temporalmente no disponible' },
      { status: 503 }
    );
  }
}

// POST /api/businesses — registro de negocio (nace pending).
// lat/lng llegan ya geocodificados (Nominatim en el modal, write-time only).
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  // Validación estricta: una petición incompleta/inválida NO crea un negocio
  // con valores por defecto inventados (uo mensaje de error claro).
  const lat = body.lat;
  const lng = body.lng;
  if (typeof lat !== 'number' || lat < -90 || lat > 90 || Number.isNaN(lat)) {
    return NextResponse.json({ success: false, error: 'lat inválida (debe ser -90..90)' }, { status: 400 });
  }
  if (typeof lng !== 'number' || lng < -180 || lng > 180 || Number.isNaN(lng)) {
    return NextResponse.json({ success: false, error: 'lng inválida (debe ser -180..180)' }, { status: 400 });
  }
  const rawName = typeof body.name === 'string' ? body.name.trim() : '';
  if (rawName.length < 3) {
    return NextResponse.json({ success: false, error: 'name requerido (mínimo 3 caracteres)' }, { status: 400 });
  }
  if (rawName.length > 120) {
    return NextResponse.json({ success: false, error: 'name demasiado largo (máximo 120 caracteres)' }, { status: 400 });
  }
  const validCategories = ['tiendas', 'comida', 'farmacias', 'cafeterias', 'servicios', 'ferreteria', 'ropa'];
  if (typeof body.category !== 'string' || !validCategories.includes(body.category)) {
    return NextResponse.json({ success: false, error: 'category inválida' }, { status: 400 });
  }
  if (typeof body.province !== 'string' || body.province.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'province requerida' }, { status: 400 });
  }
  if (typeof body.municipality !== 'string' || body.municipality.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'municipality requerido' }, { status: 400 });
  }
  const rawAddress = typeof body.address === 'string' ? body.address.trim() : '';
  if (rawAddress.length < 3) {
    return NextResponse.json({ success: false, error: 'address requerida (mínimo 3 caracteres)' }, { status: 400 });
  }
  if (rawAddress.length > 500) {
    return NextResponse.json({ success: false, error: 'address demasiado larga (máximo 500 caracteres)' }, { status: 400 });
  }
  const capped = (v: unknown, max: number) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';

  const details =
    body.transferDetails && typeof body.transferDetails === 'object'
      ? (body.transferDetails as Record<string, unknown>)
      : {};
  const newBusiness: Business = {
    id: crypto.randomUUID(),
    name: rawName,
    category: body.category,
    categoryIcon: typeof body.categoryIcon === 'string' ? body.categoryIcon : '🏪',
    description: capped(body.description, 2000),
    province: body.province.trim(),
    municipality: body.municipality.trim(),
    neighborhood: capped(body.neighborhood, 120),
    address: rawAddress,
    lat,
    lng,
    acceptsTransfer: body.acceptsTransfer !== false,
    transferActiveNow: body.transferActiveNow !== false,
    transferDetails: {
      transfermovil: true,
      enzona: details.enzona === true,
      qrPayment: details.qrPayment === true,
      onlineGateway: details.onlineGateway === true,
      cash: true
    },
    transferVerified: false,
    lastStatusUpdate: 'Registrado hoy (Pendiente de aprobación)',
    lastUpdatedDate: new Date().toISOString(),
    confirmationsCount: 1,
    reportsCount: 0,
    hours: capped(body.hours, 120),
    whatsapp: capped(body.whatsapp, 32),
    phone: capped(body.phone, 32),
    rating: 5.0,
    reviewsCount: 1,
    photos: sanitizePhotos(body.photos),
    featured: false,
    status: 'pending'
  };

  try {
    await insertBusiness(newBusiness);
    return NextResponse.json({ success: true, business: newBusiness }, { status: 201 });
  } catch (err) {
    // Producción: fallo real de BD → 503 (no un falso "registrado").
    console.error('[api] error registrando negocio:', (err as Error)?.message ?? err);
    return NextResponse.json(
      { success: false, error: 'Servicio temporalmente no disponible' },
      { status: 503 }
    );
  }
}

const VALID_ACTIONS = new Set([
  'verify',
  'approve',
  'reject',
  'toggleTransferActive',
  'vote',
  'report',
  'delete'
]);

// Acciones de moderación que exigen sesión admin; vote/report son público.
const ADMIN_ACTIONS = new Set([
  'verify',
  'approve',
  'reject',
  'toggleTransferActive',
  'delete'
]);

// PATCH /api/businesses — acciones sobre un negocio (votos, admin, estado).
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, payload } = body as {
      id?: string;
      action?: string;
      payload?: { verified?: boolean; isConfirm?: boolean };
    };

    if (!id || !action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid id and action required' },
        { status: 400 }
      );
    }

    if (ADMIN_ACTIONS.has(action) && !sessionValidFromRequest(req)) {
      return NextResponse.json(
        { success: false, error: 'Sesión de administración requerida' },
        { status: 401 }
      );
    }

    const updated = await patchBusiness(id, action as PatchAction, payload);
    if (!updated && action !== 'delete') {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...(updated ? { business: updated } : { deleted: true })
    });
  } catch (err) {
    // Producción: fallo real de BD → 503; el resto de errores → 400.
    if ((err as Error)?.message === 'Database unavailable') {
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente no disponible' },
        { status: 503 }
      );
    }
    console.error('[api] error en PATCH /api/businesses:', (err as Error)?.message ?? err);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 400 });
  }
}
