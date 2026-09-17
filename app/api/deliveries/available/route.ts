import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { listAvailableDeliveries, DbUnavailableError, type DeliveryRequestRow } from '@/lib/db-delivery';

export const dynamic = 'force-dynamic';

function toAvailableDTO(r: DeliveryRequestRow) {
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    packageType: r.package_type,
    packageNote: r.package_note,
    fragile: r.fragile,
    payableOnDelivery: r.payable_on_delivery,
    distanceKm: r.distance_km === null || r.distance_km === undefined ? null : Number(r.distance_km),
    durationMin: r.duration_min,
    totalFareCup: r.total_fare_cup === null || r.total_fare_cup === undefined ? null : Number(r.total_fare_cup),
    requestedAt: r.requested_at.toISOString(),
    pickup: {
      lat: r.pickup_lat,
      lng: r.pickup_lng,
      address: r.pickup_address,
      note: r.pickup_note
    }
  };
}

// GET /api/deliveries/available — carreras PENDING para el mensajero.
// Privacidad: sin dirección de entrega, sin identidad del solicitante y sin
// contacto; el mensajero solo ve recogida + distancia/tarifa para decidir.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'MESSENGER');
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? 'Inicia sesión primero' : 'Solo para mensajeros' },
      { status: auth.status }
    );
  }
  try {
    const rows = await listAvailableDeliveries(30);
    return NextResponse.json({ success: true, deliveries: rows.map(toAvailableDTO) });
  } catch (err) {
    if (err instanceof DbUnavailableError) {
      return NextResponse.json({ success: false, error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    console.error('[api] GET /api/deliveries/available:', (err as Error)?.message ?? err);
    return NextResponse.json({ success: false, error: 'No se pudieron listar las carreras' }, { status: 400 });
  }
}