import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPricingConfig } from '@/lib/db-delivery';
import { computeFare, fareBreakdown } from '@/lib/pricing';
import { calculateOSRMRoute } from '@/lib/osrm';

export const dynamic = 'force-dynamic';

function parseCoord(v: string | null, min: number, max: number): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// GET /api/deliveries/estimate?fromLat&fromLng&toLat&toLng
// Estima distancia, duración y tarifa SIN crear la carrera. La ruta real se
// recalcula una sola vez al solicitar (write-time, nunca en cada vista).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: 'Inicia sesión primero' }, { status: auth.status });

  const sp = req.nextUrl.searchParams;
  const fromLat = parseCoord(sp.get('fromLat'), -90, 90);
  const fromLng = parseCoord(sp.get('fromLng'), -180, 180);
  const toLat = parseCoord(sp.get('toLat'), -90, 90);
  const toLng = parseCoord(sp.get('toLng'), -180, 180);
  if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
    return NextResponse.json(
      { success: false, error: 'Coordenadas inválidas (fromLat, fromLng, toLat, toLng)' },
      { status: 400 }
    );
  }

  const route = await calculateOSRMRoute(
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng }
  );
  if (!route || route.distanceMeters <= 0) {
    return NextResponse.json(
      { success: false, error: 'No se pudo calcular la ruta ahora. Inténtalo de nuevo.' },
      { status: 502 }
    );
  }

  const distanceKm = route.distanceMeters / 1000;
  const cfg = await getPricingConfig();
  return NextResponse.json({
    success: true,
    distanceMeters: route.distanceMeters,
    distanceKm: Number(distanceKm.toFixed(1)),
    durationMin: Math.max(1, Math.round(route.durationSeconds / 60)),
    totalFareCup: computeFare(distanceKm, cfg),
    breakdown: fareBreakdown(distanceKm, cfg)
  });
}