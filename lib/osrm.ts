/**
 * OSRM (Open Source Routing Machine) Service for TransferCuba
 * Computes driving/walking paths and distances using OpenStreetMap road network.
 */

export interface OSRMRouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat] format for GeoJSON
  };
  summary: string;
}

/**
 * Fetch routing between start [lat, lng] and end [lat, lng]
 */
export async function calculateOSRMRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): Promise<OSRMRouteResult | null> {
  try {
    // OSRM expects {lng},{lat};{lng},{lat}
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      geometry: route.geometry,
      summary: (route.legs && route.legs[0]?.summary) || ''
    };
  } catch (err) {
    console.warn('OSRM routing request failed:', err);
    return null;
  }
}
