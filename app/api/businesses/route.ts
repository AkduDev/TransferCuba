import { NextRequest, NextResponse } from 'next/server';
import { Business, INITIAL_BUSINESSES, calculateDistanceMeters } from '@/lib/cuba-data';

// Server-side in-memory store initialized with initial businesses
// In production with PostgreSQL/PostGIS, this queries via ST_DWithin / ST_Distance
let serverBusinesses: Business[] = [...INITIAL_BUSINESSES];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const radiusParam = searchParams.get('radius'); // meters (e.g. 2000 for 2km)
  const category = searchParams.get('category');
  const province = searchParams.get('province');
  const municipality = searchParams.get('municipality');
  const transfer = searchParams.get('transfer');
  const activeNow = searchParams.get('activeNow');
  const verification = searchParams.get('verification'); // verified, pending, reported
  const q = searchParams.get('q');

  let results = [...serverBusinesses];

  // 1. Province filter
  if (province && province !== 'all') {
    results = results.filter(
      (b) => b.province.toLowerCase() === province.toLowerCase()
    );
  }

  // 2. Municipality filter
  if (municipality && municipality !== 'all') {
    results = results.filter(
      (b) => b.municipality.toLowerCase() === municipality.toLowerCase()
    );
  }

  // 3. Category filter
  if (category && category !== 'all') {
    results = results.filter((b) => b.category === category);
  }

  // 4. Accepts transfer
  if (transfer === 'true') {
    results = results.filter((b) => b.acceptsTransfer);
  }

  // 5. Transfer active now
  if (activeNow === 'true') {
    results = results.filter((b) => b.transferActiveNow);
  }

  // 6. Verification status (verified, pending, reported)
  if (verification && verification !== 'all') {
    results = results.filter((b) => {
      const vStatus = b.reportsCount > 0 ? 'reported' : b.transferVerified ? 'verified' : 'pending';
      return vStatus === verification;
    });
  }

  // 7. Text search (Name, Description, Address, Municipality)
  if (q && q.trim()) {
    const query = q.toLowerCase().trim();
    results = results.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.description.toLowerCase().includes(query) ||
        b.address.toLowerCase().includes(query) ||
        b.municipality.toLowerCase().includes(query) ||
        (b.neighborhood && b.neighborhood.toLowerCase().includes(query))
    );
  }

  // 8. PostGIS Spatial Filter & Distance Sorting (ST_DWithin & ST_Distance equivalent)
  if (latParam && lngParam) {
    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);

    if (!isNaN(lat) && !isNaN(lng)) {
      results = results.map((b) => {
        const dist = calculateDistanceMeters(lat, lng, b.lat, b.lng);
        return {
          ...b,
          distanceMeters: dist
        };
      });

      // PostGIS ST_DWithin: filter by radius if provided
      if (radiusParam) {
        const radiusMeters = parseFloat(radiusParam);
        if (!isNaN(radiusMeters) && radiusMeters > 0) {
          results = results.filter((b) => (b.distanceMeters ?? 0) <= radiusMeters);
        }
      }

      // PostGIS ST_Distance: sort ascending by proximity
      results.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    }
  } else {
    // Default sorting: verified / rating
    results.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return b.rating - a.rating;
    });
  }

  return NextResponse.json({
    success: true,
    total: results.length,
    businesses: results
  });
}

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
      lat: body.lat || 23.1136,
      lng: body.lng || -82.3666,
      acceptsTransfer: body.acceptsTransfer ?? true,
      transferActiveNow: body.transferActiveNow ?? true,
      transferDetails: body.transferDetails || {
        transfermovil: true,
        enzona: false,
        qrPayment: false,
        onlineGateway: false,
        cash: true
      },
      transferVerified: false, // 🟡 Default is pending approval
      lastStatusUpdate: 'Registrado recientemente',
      lastUpdatedDate: new Date().toISOString(),
      confirmationsCount: 1,
      reportsCount: 0,
      hours: body.hours || '9:00 AM - 6:00 PM',
      whatsapp: body.whatsapp || '',
      phone: body.phone || '',
      rating: 5.0,
      reviewsCount: 1,
      photos: body.photos && body.photos.length > 0 ? body.photos : ['https://picsum.photos/seed/cuba-biz/600/400'],
      featured: false,
      status: 'pending' // 🟡 6-step review status
    };

    serverBusinesses = [newBusiness, ...serverBusinesses];

    return NextResponse.json({
      success: true,
      business: newBusiness
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, payload } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Business ID required' }, { status: 400 });
    }

    const index = serverBusinesses.findIndex((b) => b.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const current = serverBusinesses[index];

    if (action === 'verify') {
      current.transferVerified = payload?.verified ?? !current.transferVerified;
      current.status = current.transferVerified ? 'active' : 'pending';
      current.lastStatusUpdate = 'Verificado por TransferCuba';
    } else if (action === 'toggleTransferActive') {
      current.transferActiveNow = !current.transferActiveNow;
      current.lastStatusUpdate = 'Hace un momento';
    } else if (action === 'vote') {
      if (payload?.isConfirm) {
        current.confirmationsCount += 1;
      } else {
        current.reportsCount += 1;
      }
      current.lastStatusUpdate = 'Confirmado por la comunidad hoy';
    } else if (action === 'report') {
      current.reportsCount += 1;
      current.lastStatusUpdate = 'Reportado por usuario';
    }

    serverBusinesses[index] = { ...current };

    return NextResponse.json({
      success: true,
      business: serverBusinesses[index]
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 400 });
  }
}
