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
