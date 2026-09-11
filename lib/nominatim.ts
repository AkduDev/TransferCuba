/**
 * Nominatim OpenStreetMap Geocoding Service for TransferCuba
 * Provides address geocoding and reverse geocoding in Cuba.
 */

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
}

/**
 * Search Cuban addresses via Nominatim OSM
 * Appends Cuba context to ensure high precision within the island
 */
export async function searchNominatimAddress(query: string, province?: string): Promise<NominatimResult[]> {
  try {
    const fullQuery = province && province !== 'all' 
      ? `${query}, ${province}, Cuba` 
      : `${query}, Cuba`;

    const encoded = encodeURIComponent(fullQuery);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=cu&limit=5&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'es',
        'User-Agent': 'TransferCuba-Applet/1.0 (devparadise-cuba)'
      }
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Nominatim geocoding error:', error);
    return [];
  }
}

// Politica de uso de Nominatim: maximo 1 req/s con User-Agent identificatorio.
// Este wrapper garantiza un intervalo minimo entre peticiones reales (medido
// al completarse cada request) y encola la siguiente hasta cumplirlo.
const NOMINATIM_MIN_INTERVAL_MS = 1100;
let lastNominatimRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchNominatimAddressRateLimited(
  query: string,
  province?: string
): Promise<NominatimResult[]> {
  const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  try {
    return await searchNominatimAddress(query, province);
  } finally {
    lastNominatimRequestAt = Date.now();
  }
}

/**
 * Reverse geocode coordinates to get street and municipality name
 */
export async function reverseNominatimCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'es',
        'User-Agent': 'TransferCuba-Applet/1.0 (devparadise-cuba)'
      }
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch (error) {
    console.warn('Nominatim reverse error:', error);
    return null;
  }
}
