import { NextRequest, NextResponse } from 'next/server';
import { queryBusinesses, insertBusiness, patchBusiness, PatchAction } from '@/lib/db';
import { Business } from '@/lib/cuba-data';

export const dynamic = 'force-dynamic';

// GET /api/businesses — filtros + spatial queries (viewport bbox / nearby).
// Sprint 2: PostGIS con ST_MakeEnvelope && / ST_DWithin / ST_Distance;
// sin DATABASE_URL cae al fallback in-memory (dev).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const radiusParam = searchParams.get('radius');
  const bboxParam = searchParams.get('bbox'); // w,s,e,n

  let bbox: [number, number, number, number] | undefined;
  if (bboxParam) {
    const parts = bboxParam.split(',').map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      bbox = parts as [number, number, number, number];
    }
  }

  const results = await queryBusinesses({
    bbox,
    lat: latParam ? parseFloat(latParam) : undefined,
    lng: lngParam ? parseFloat(lngParam) : undefined,
    radius: radiusParam ? parseFloat(radiusParam) : undefined,
    province: searchParams.get('province') ?? undefined,
    municipality: searchParams.get('municipality') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    onlyTransfer: searchParams.get('transfer') === 'true',
    activeNow: searchParams.get('activeNow') === 'true',
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
}

// POST /api/businesses — registro de negocio (nace pending).
// lat/lng llegan ya geocodificados (Nominatim en el modal, write-time only).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const newBusiness: Business = {
      id: `biz-${Date.now()}`,
      name: body.name || 'Nuevo Negocio',
      category: body.category || 'tiendas',
      categoryIcon: body.categoryIcon || '🏪',
      description: body.description || '',
      province: body.province || 'La Habana',
      municipality: body.municipality || 'Playa',
      neighborhood: body.neighborhood || '',
      address: body.address || '',
      lat: body.lat ?? 23.1136,
      lng: body.lng ?? -82.3666,
      acceptsTransfer: body.acceptsTransfer ?? true,
      transferActiveNow: body.transferActiveNow ?? true,
      transferDetails: body.transferDetails || {
        transfermovil: true,
        enzona: false,
        qrPayment: false,
        onlineGateway: false,
        cash: true
      },
      transferVerified: false,
      lastStatusUpdate: 'Registrado hoy (Pendiente de aprobación)',
      lastUpdatedDate: new Date().toISOString(),
      confirmationsCount: 1,
      reportsCount: 0,
      hours: body.hours || '9:00 AM - 6:00 PM',
      whatsapp: body.whatsapp || '',
      phone: body.phone || '',
      rating: 5.0,
      reviewsCount: 1,
      photos: body.photos?.length ? body.photos : ['https://picsum.photos/seed/cuba-biz/600/400'],
      featured: false,
      status: 'pending'
    };

    await insertBusiness(newBusiness);

    return NextResponse.json({ success: true, business: newBusiness }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
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

    const updated = await patchBusiness(id, action as PatchAction, payload);
    if (!updated && action !== 'delete') {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...(updated ? { business: updated } : { deleted: true })
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 400 });
  }
}
