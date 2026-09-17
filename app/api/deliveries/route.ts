import { NextRequest, NextResponse } from 'next/server';
import { PACKAGE_TYPES, toCoord, toOptionalNote, isValidAddress } from '@/lib/delivery-validate';
import {
  createDeliveryRequest,
  getPricingConfig,
  listDeliveriesForRequester,
  DbUnavailableError,
  type PackageType
} from '@/lib/db-delivery';
import { computeFare } from '@/lib/pricing';
import { calculateOSRMRoute } from '@/lib/osrm';
import { toDeliveryDTO } from '@/lib/delivery-dto';
import { requireAuth, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const REQUESTER_ROLES = ['USER', 'BUSINESS', 'ADMIN'] as const;

// GET /api/deliveries — historial del solicitante autenticado.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ...REQUESTER_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: 'Inicia sesión primero' }, { status: auth.status });
  }
  try {
    const rows = await listDeliveriesForRequester(auth.user.id, 30);
    return NextResponse.json({
      success: true,
      deliveries: rows.map((r) =>
        toDeliveryDTO(r, { includeLocations: true, includeRequester: true, includeMessenger: true })
      )
    });
  } catch (err) {
    if (err instanceof DbUnavailableError) {
      return NextResponse.json({ success: false, error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    console.error('[api] GET /api/deliveries:', (err as Error)?.message ?? err);
    return NextResponse.json({ success: false, error: 'No se pudo listar' }, { status: 400 });
  }
}

// POST /api/deliveries — crea la carrera. La ruta OSRM se calcula UNA vez aquí
// (write-time) y se persiste para que la vista recurrente no la recalcule.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ...REQUESTER_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: 'Inicia sesión primero' }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const packageType = body.packageType as PackageType;
  if (!(PACKAGE_TYPES as readonly string[]).includes(packageType)) {
    return NextResponse.json({ success: false, error: 'Tipo de paquete inválido' }, { status: 400 });
  }

  const pickup = body.pickup as Record<string, unknown> | undefined;
  const dropoff = body.dropoff as Record<string, unknown> | undefined;
  const pickupLat = toCoord(pickup?.lat);
  const pickupLng = toCoord(pickup?.lng, -180, 180);
  const dropoffLat = toCoord(dropoff?.lat);
  const dropoffLng = toCoord(dropoff?.lng, -180, 180);
  if (
    pickupLat === null || pickupLng === null || dropoffLat === null || dropoffLng === null ||
    !isValidAddress(pickup?.address) || !isValidAddress(dropoff?.address)
  ) {
    return NextResponse.json(
      { success: false, error: 'Localización y dirección de recogida y entrega son obligatorias' },
      { status: 400 }
    );
  }

  const route = await calculateOSRMRoute(
    { lat: pickupLat, lng: pickupLng },
    { lat: dropoffLat, lng: dropoffLng }
  );
  if (!route || route.distanceMeters <= 0) {
    return NextResponse.json(
      { success: false, error: 'No se pudo calcular la ruta ahora. Inténtalo de nuevo.' },
      { status: 502 }
    );
  }

  const distanceKm = route.distanceMeters / 1000;
  const cfg = await getPricingConfig();

  try {
    const row = await createDeliveryRequest({
      requesterId: auth.user.id,
      packageType,
      packageNote: toOptionalNote(body.packageNote) ?? undefined,
      fragile: body.fragile === true,
      payableOnDelivery: body.payableOnDelivery === true,
      pickup: {
        lat: pickupLat,
        lng: pickupLng,
        address: String(pickup?.address).trim(),
        note: toOptionalNote(pickup?.note) ?? undefined
      },
      dropoff: {
        lat: dropoffLat,
        lng: dropoffLng,
        address: String(dropoff?.address).trim(),
        note: toOptionalNote(dropoff?.note) ?? undefined
      },
      distanceKm: Number(distanceKm.toFixed(1)),
      durationMin: Math.max(1, Math.round(route.durationSeconds / 60)),
      routeGeojson: route.geometry,
      totalFareCup: computeFare(distanceKm, cfg)
    });
    return NextResponse.json(
      { success: true, delivery: toDeliveryDTO(row, { includeLocations: true, includeRequester: true }) },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof DbUnavailableError) {
      return NextResponse.json({ success: false, error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    console.error('[api] POST /api/deliveries:', (err as Error)?.message ?? err);
    return NextResponse.json({ success: false, error: 'No se pudo crear la carrera' }, { status: 400 });
  }
}