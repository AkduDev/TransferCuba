import { useState, useEffect, useRef, useCallback } from 'react';
import { searchNominatimAddressRateLimited } from '@/lib/nominatim';
import type { NominatimResult } from '@/lib/nominatim';

export interface GeocodingState {
  geocodePlaces: NominatimResult[];
  isGeocoding: boolean;
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  handleSelectPlace: (place: NominatimResult) => void;
}

export function useGeocoding(
  searchQuery: string,
  selectedProvince: string,
  setSearchQuery: (q: string) => void,
  centerOn: (lat: number, lng: number, zoom: number) => void,
  showToast: (msg: string) => void
): GeocodingState {
  const [geocodePlaces, setGeocodePlaces] = useState<NominatimResult[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const geocodeTokenRef = useRef(0);

  useEffect(() => {
    const q = searchQuery.trim();
    const token = ++geocodeTokenRef.current;
    const debounceTimer = setTimeout(async () => {
      if (q.length < 3) {
        if (token !== geocodeTokenRef.current) return;
        setGeocodePlaces([]);
        setIsGeocoding(false);
        return;
      }
      setIsGeocoding(true);
      const places = await searchNominatimAddressRateLimited(q, selectedProvince);
      if (token !== geocodeTokenRef.current) return;
      setGeocodePlaces(places.slice(0, 5));
      setIsGeocoding(false);
    }, q.length < 3 ? 0 : 350);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedProvince]);

  const handleSelectPlace = useCallback(
    (place: NominatimResult) => {
      const lat = parseFloat(place.lat);
      const lng = parseFloat(place.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      centerOn(lat, lng, 15);
      const parts = place.display_name.split(',').map((p) => p.trim());
      const shortName = parts.slice(0, 2).join(', ');
      setSearchQuery(shortName);
      setSearchFocused(false);
      showToast(`\u{1F4CD} ${shortName}`);
    },
    [centerOn, setSearchQuery, showToast]
  );

  return { geocodePlaces, isGeocoding, searchFocused, setSearchFocused, handleSelectPlace };
}