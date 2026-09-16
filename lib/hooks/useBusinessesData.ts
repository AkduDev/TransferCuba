import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Business, INITIAL_BUSINESSES, calculateDistanceMeters } from '@/lib/cuba-data';

export interface BusinessesFilters {
  searchQuery: string;
  selectedProvince: string;
  selectedMunicipality: string;
  selectedCategory: string;
  onlyTransfer: boolean;
  onlyActiveNow: boolean;
  filterVerification: string;
  filterQr: boolean;
  filterOnline: boolean;
}

interface UseBusinessesDataParams {
  filters: BusinessesFilters;
  viewportBbox: [number, number, number, number] | null;
  userLocation: { lat: number; lng: number } | null;
}

export function useBusinessesData({ filters, viewportBbox, userLocation }: UseBusinessesDataParams) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [adminAllBusinesses, setAdminAllBusinesses] = useState<Business[] | null>(null);
  const [isSyncingFromApi, setIsSyncingFromApi] = useState(true);
  const filtersVersionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Hidratación offline: cache local primero, seed solo en dev.
  useEffect(() => {
    const hydrate = () => {
      const saved = localStorage.getItem('transfercuba_businesses_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Business[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBusinesses(parsed);
            return;
          }
        } catch {
          // cache corrupto -> seed
        }
      }
      setBusinesses(process.env.NODE_ENV === 'production' ? [] : INITIAL_BUSINESSES);
    };
    const t = setTimeout(hydrate, 0);
    return () => clearTimeout(t);
  }, []);

  const {
    searchQuery, selectedProvince, selectedMunicipality, selectedCategory,
    onlyTransfer, onlyActiveNow, filterVerification, filterQr, filterOnline
  } = filters;

  useEffect(() => {
    const t = setTimeout(() => {
      const version = ++filtersVersionRef.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const params = new URLSearchParams();
      if (viewportBbox) params.set('bbox', viewportBbox.join(','));
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedProvince !== 'all') params.set('province', selectedProvince);
      if (selectedMunicipality !== 'all') params.set('municipality', selectedMunicipality);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (onlyTransfer) params.set('transfer', 'true');
      if (onlyActiveNow) params.set('activeNow', 'true');
      if (filterQr) params.set('qr', 'true');
      if (filterOnline) params.set('online', 'true');
      if (filterVerification !== 'all') params.set('verification', filterVerification);
      if (userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
      }
      params.set('limit', '500');

      (async () => {
        try {
          const res = await fetch(`/api/businesses?${params.toString()}`, {
            cache: 'no-store',
            signal: ac.signal
          });
          if (!res.ok) return;
          const data = (await res.json()) as { success: boolean; businesses: Business[] };
          if (data.success && Array.isArray(data.businesses) && filtersVersionRef.current === version) {
            setBusinesses((prev) => {
              const serverIds = new Set(data.businesses.map((b) => b.id));
              const localNonActive = prev.filter((b) => b.status !== 'active' && !serverIds.has(b.id));
              return [...data.businesses, ...localNonActive];
            });
          }
        } catch {
          // offline / abort: cache local
        } finally {
          if (filtersVersionRef.current === version) setIsSyncingFromApi(false);
        }
      })();
    }, 300);

    return () => clearTimeout(t);
  }, [
    viewportBbox, searchQuery, selectedProvince, selectedMunicipality, selectedCategory,
    onlyTransfer, onlyActiveNow, filterQr, filterOnline, filterVerification, userLocation
  ]);

  // Persist to localStorage (offline cache)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isSyncingFromApi) {
      localStorage.setItem('transfercuba_businesses_v2', JSON.stringify(businesses));
    }
  }, [businesses, isSyncingFromApi]);

  // Server sync helper — envía mutations a la API best-effort.
  const syncMutation = useCallback(async (id: string, action: string, payload?: Record<string, unknown>) => {
    try {
      await fetch('/api/businesses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, payload })
      });
    } catch {
      // offline: cache local al próximo sync
    }
  }, []);

  // Admin: negocios con TODOS los status.
  const fetchAdminAll = useCallback(async () => {
    try {
      const res = await fetch('/api/businesses?includeAll=true&limit=500', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { success: boolean; businesses: Business[] };
      if (data.success && Array.isArray(data.businesses)) {
        setAdminAllBusinesses((prev) => {
          const serverIds = new Set(data.businesses.map((b) => b.id));
          const localExtra = (prev ?? businesses).filter(
            (b) => !serverIds.has(b.id) && b.status !== 'active'
          );
          return [...data.businesses, ...localExtra];
        });
      }
    } catch {
      // offline: admin opera con lo local
    }
  }, [businesses]);

  const handleAdminClose = useCallback(() => {
    setAdminAllBusinesses(null);
  }, []);

  // Aplica una transformación a un negocio en ambos estados (general + admin).
  const applyToStates = useCallback(
    (bizId: string, transform: (b: Business) => Business, remove = false) => {
      setBusinesses((prev) =>
        remove ? prev.filter((b) => b.id !== bizId) : prev.map((b) => (b.id === bizId ? transform(b) : b))
      );
      setAdminAllBusinesses((prev) =>
        prev
          ? remove
            ? prev.filter((b) => b.id !== bizId)
            : prev.map((b) => (b.id === bizId ? transform(b) : b))
          : prev
      );
    },
    []
  );

  // Filtrado + ranking final (el server ya aplicó filtros+bbox PostGIS).
  const filteredBusinesses = useMemo(() => {
    let result = (adminAllBusinesses ?? businesses).filter((b) =>
      adminAllBusinesses ? true : b.status === 'active'
    );

    if (selectedProvince !== 'all') {
      result = result.filter((b) => b.province.toLowerCase() === selectedProvince.toLowerCase());
    }
    if (selectedMunicipality !== 'all') {
      result = result.filter((b) => b.municipality.toLowerCase() === selectedMunicipality.toLowerCase());
    }
    if (selectedCategory !== 'all') {
      result = result.filter((b) => b.category === selectedCategory);
    }
    if (onlyTransfer) {
      result = result.filter((b) => b.acceptsTransfer);
    }
    if (onlyActiveNow) {
      result = result.filter((b) => b.transferActiveNow);
    }
    if (filterQr) {
      result = result.filter((b) => b.transferDetails?.qrPayment);
    }
    if (filterOnline) {
      result = result.filter((b) => b.transferDetails?.onlineGateway);
    }
    if (filterVerification !== 'all') {
      result = result.filter((b) => {
        const isReported = b.reportsCount > 0;
        const isVerified = b.transferVerified && !isReported;
        const isPending = !isVerified && !isReported;
        if (filterVerification === 'verified') return isVerified;
        if (filterVerification === 'pending') return isPending;
        if (filterVerification === 'reported') return isReported;
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q) ||
          b.municipality.toLowerCase().includes(q) ||
          (b.neighborhood && b.neighborhood.toLowerCase().includes(q))
      );
    }
    if (userLocation) {
      result = result.map((b) => {
        const dist = calculateDistanceMeters(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return { ...b, distanceMeters: dist };
      });
      result.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
    } else {
      result.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return b.rating - a.rating;
      });
    }
    return result;
  }, [
    businesses, adminAllBusinesses, searchQuery, selectedProvince, selectedMunicipality,
    selectedCategory, onlyTransfer, onlyActiveNow, filterQr, filterOnline,
    filterVerification, userLocation
  ]);

  return {
    businesses, setBusinesses, adminAllBusinesses, setAdminAllBusinesses,
    syncMutation, fetchAdminAll, handleAdminClose, applyToStates, filteredBusinesses
  };
}