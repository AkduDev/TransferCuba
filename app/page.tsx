'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import GoogleMapsTopBar from '@/components/GoogleMapsTopBar';
import GoogleMapsDesktopPanel from '@/components/GoogleMapsDesktopPanel';
import GoogleMapsMobileBottomSheet from '@/components/GoogleMapsMobileBottomSheet';
import GoogleMapsFloatingControls from '@/components/GoogleMapsFloatingControls';
import GoogleMapsFiltersModal from '@/components/GoogleMapsFiltersModal';
import GoogleMapsSideDrawer from '@/components/GoogleMapsSideDrawer';
import RouteInfoBar from '@/components/RouteInfoBar';
import RegisterBusinessModal from '@/components/RegisterBusinessModal';
import AdminDashboardModal from '@/components/AdminDashboardModal';
import LocationPickerModal from '@/components/LocationPickerModal';
import MapErrorBoundary from '@/components/MapErrorBoundary';
import {
  Business,
  INITIAL_BUSINESSES,
  CUBAN_PROVINCES,
  CATEGORIES,
  CATEGORY_EMOJI,
  calculateDistanceMeters
} from '@/lib/cuba-data';
import { calculateOSRMRoute, OSRMRouteResult } from '@/lib/osrm';
import type { NominatimResult } from '@/lib/nominatim';
import { searchNominatimAddressRateLimited } from '@/lib/nominatim';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { ClusterInfo } from '@/components/MapLibreMap';
import {
  Check,
  Sparkles,
  MapPin,
  ShieldCheck,
  X as XIcon
} from 'lucide-react';

// Dynamically import MapLibre GL JS map with no SSR
const MapLibreMap = dynamic(() => import('@/components/MapLibreMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      <p className="text-xs sm:text-sm font-semibold text-slate-700">
        Iniciando MapLibre GL JS + OpenStreetMap Cuba...
      </p>
    </div>
  )
});

export default function Home() {
  // Persistence state — localStorage actúa como cache offline (no como DB).
  // Sprint 2: la fuente de verdad es la API (PostGIS en producción).
  // Estado inicial SIEMPRE vacío: el server renderiza la lista vacía y el
  // cliente hidrata en useEffect (localStorage o INITIAL_BUSINESSES).
  // Lee en el render inicial causaba hydration mismatch (React #418):
  // server pintaba el seed con Date.now() del server y el cliente otros datos.
  const [businesses, setBusinesses] = useState<Business[]>([]);

  // Search & Filter states (declarados primero: los usa el efecto de fetch)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('La Habana');
  const [selectedMunicipality, setSelectedMunicipality] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [onlyTransfer, setOnlyTransfer] = useState(true);
  const [onlyActiveNow, setOnlyActiveNow] = useState(false);
  const [filterVerification, setFilterVerification] = useState('all'); // 'all' | 'verified' | 'pending' | 'reported'
  const [filterQr, setFilterQr] = useState(false);
  const [filterOnline, setFilterOnline] = useState(false);

  // User location / GPS state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Hydrate + server-side filtered fetch (Sprint 3).
  // La API (PostGIS) aplica todos los filtros y el bbox del viewport;
  // el cliente solo ordena/retoca. viewportBbox llega de moveend (MapLibreMap).
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number] | null>(null);
  const [isSyncingFromApi, setIsSyncingFromApi] = useState(true);
  const filtersVersionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Hidratación offline: cache local primero, seed solo como último recurso.
  // Corre post-mount (client only) para no romper la hidratación de React.
  // Diferido un tick: el setState síncrono dentro del efecto dispara la regla
  // react-hooks/set-state-in-effect (render en cascada).
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
      setBusinesses(INITIAL_BUSINESSES);
    };
    const t = setTimeout(hydrate, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // debounce: espera a que paren los cambios de filtros/viewport
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
            // Merge: server actives + negocios locales no activos (pending/rejected)
            // para que el admin no pierda pendientes registrados offline/sin bbox.
            setBusinesses((prev) => {
              const serverIds = new Set(data.businesses.map((b) => b.id));
              const localNonActive = prev.filter((b) => b.status !== 'active' && !serverIds.has(b.id));
              return [...data.businesses, ...localNonActive];
            });
          }
        } catch {
          // offline / abort: seguimos con cache local
        } finally {
          if (filtersVersionRef.current === version) setIsSyncingFromApi(false);
        }
      })();
    }, 300);

    return () => clearTimeout(t);
  }, [
    viewportBbox,
    searchQuery,
    selectedProvince,
    selectedMunicipality,
    selectedCategory,
    onlyTransfer,
    onlyActiveNow,
    filterQr,
    filterOnline,
    filterVerification,
    userLocation
  ]);

  // Persist to localStorage (offline cache)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isSyncingFromApi) {
      localStorage.setItem('transfercuba_businesses_v2', JSON.stringify(businesses));
    }
  }, [businesses, isSyncingFromApi]);

  // Server sync helper — envía mutations a la API (PostGIS) best-effort;
  // si falla (offline), el estado local queda como cache hasta el próximo sync.
  const syncMutation = useCallback(
    async (id: string, action: string, payload?: Record<string, unknown>) => {
      try {
        await fetch('/api/businesses', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action, payload })
        });
      } catch {
        // offline: la optimización local persiste en localStorage
      }
    },
    []
  );

  // Admin: negociones con TODOS los status (server includeAll).
  // Mientras el panel está abierto, anula el filtrado por viewport.
  const [adminAllBusinesses, setAdminAllBusinesses] = useState<Business[] | null>(null);

  const fetchAdminAll = useCallback(async () => {
    try {
      const res = await fetch('/api/businesses?includeAll=true&limit=500', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { success: boolean; businesses: Business[] };
      if (data.success && Array.isArray(data.businesses)) {
        // merge con locales (por si hay pendientes offline recientes)
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

  // Al cerrar el panel admin, soltar el override
  const handleAdminClose = useCallback(() => {
    setAdminAllBusinesses(null);
  }, []);

  // Desktop Panel & Modals state
  const [isDesktopPanelOpen, setIsDesktopPanelOpen] = useState(true);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);

  // Selected Business
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  const [userLocationName, setUserLocationName] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Map view center & zoom
  const [mapCenter, setMapCenter] = useState<[number, number]>([23.1385, -82.3842]); // Vedado, La Habana
  const [mapZoom, setMapZoom] = useState<number>(14);

  // OSRM Routing state
  const [activeRoute, setActiveRoute] = useState<{
    route: OSRMRouteResult;
    business: Business;
  } | null>(null);

  // Registration Pinning Mode
  const [isPinningMode, setIsPinningMode] = useState(false);
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Modals & Drawers
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [mobileSheetState, setMobileSheetState] = useState<'peek' | 'half' | 'full'>('peek');

  // Toast / notification feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Map controls (Sprint 7): instancia expuesta por MapLibreMap + UI estado
  const mapRef = useRef<MaplibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sincroniza el estado con el navegador (fullscreenchange es disparado
  // tanto por requestFullscreen como por exitFullscreen / Esc).
  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement
        .requestFullscreen()
        .catch(() => showToast('No se pudo activar la pantalla completa.'));
    }
  }, [showToast]);

  // Geocoding (Sprint 8): sugerencias de lugares de Nominatim mientras se
  // teclea. Debounce de 350ms por peticion + throttle de 1 req/s en el lib.
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
      setMapCenter([lat, lng]);
      setMapZoom(15);
      const parts = place.display_name.split(',').map((p) => p.trim());
      const shortName = parts.slice(0, 2).join(', ');
      setSearchQuery(shortName);
      setSearchFocused(false);
      showToast(`📍 ${shortName}`);
    },
    [showToast]
  );

  // Change province updates map center and resets municipality
  const handleProvinceChange = (provinceName: string) => {
    setSelectedProvince(provinceName);
    setSelectedMunicipality('all');

    if (provinceName === 'all') {
      setMapCenter([21.8, -79.5]); // Whole Cuba island
      setMapZoom(7);
      showToast('🇨🇺 Toda la República de Cuba');
    } else {
      const pData = CUBAN_PROVINCES.find((p) => p.name === provinceName);
      if (pData) {
        setMapCenter(pData.center);
        setMapZoom(pData.zoom);
        showToast(`📍 Vista centrada en ${provinceName}`);
      }
    }
  };

  // Real GPS Geolocation Trigger
  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      showToast('Tu navegador no soporta geolocalización.');
      return;
    }

    // Re-centrado instantáneo si ya conocemos la ubicación (feedback rápido);
    // además se vuelve a adquirir el GPS para refrescar precisión.
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(15);
      setIsLocationModalOpen(false);
      showToast('📍 Re-centrado en tu ubicación GPS.');
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(coords);
        setUserLocationName('Tu ubicación GPS');
        setMapCenter([coords.lat, coords.lng]);
        setMapZoom(15);
        setIsLocating(false);
        setIsLocationModalOpen(false);
        showToast('📍 Ubicación GPS actualizada. Negocios ordenados por cercanía.');
      },
      (error) => {
        setIsLocating(false);
        setIsLocationModalOpen(false);
        // Si ya había una ubicación previa, la mantenemos (no degradamos).
        if (!userLocation) {
          const defaultPreset = { lat: 23.1385, lng: -82.3842 };
          setUserLocation(defaultPreset);
          setUserLocationName('Vedado, La Habana');
          setMapCenter([defaultPreset.lat, defaultPreset.lng]);
          setMapZoom(14);
        }
        const denied = error.code === error.PERMISSION_DENIED;
        showToast(
          denied
            ? 'Sin permiso de ubicación. Concede acceso e inténtalo de nuevo.'
            : 'GPS no disponible ahora (señal/timeout). Reintenta.'
        );
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Select Preset Location (Vedado, Santiago, Holguín, etc.)
  const handleSelectPresetLocation = (coords: { lat: number; lng: number }, name: string) => {
    setUserLocation(coords);
    setUserLocationName(name);
    setMapCenter([coords.lat, coords.lng]);
    setMapZoom(15);
    showToast(`📍 Ubicación fijada en ${name}. Negocios ordenados por proximidad.`);
  };

  // Cluster card (Sprint 9): lista de negocios dentro del cluster clickeado
  const [clusterView, setClusterView] = useState<ClusterInfo | null>(null);
  const handleClusterClick = useCallback((info: ClusterInfo) => {
    setClusterView(info);
  }, []);
  const handleCloseCluster = useCallback(() => setClusterView(null), []);
  const handleExpandCluster = useCallback(() => {
    const m = mapRef.current;
    if (!m || !clusterView) return;
    m.easeTo({
      center: [clusterView.center[1], clusterView.center[0]],
      zoom: Math.max(m.getZoom(), 15),
      duration: 800
    });
  }, [clusterView]);

  // Select Business from list or map
  const handleSelectBusiness = (business: Business | null) => {
    setSelectedBusiness(business);
    setClusterView(null);
    if (business) {
      setMapCenter([business.lat, business.lng]);
      setMapZoom(16);
      setIsDesktopPanelOpen(true);
      setMobileSheetState('peek');
    }
  };

  // Select a business suggestion from the search dropdown
  const handleSelectSearchBusiness = (b: Business) => {
    handleSelectBusiness(b);
    setSearchQuery(b.name);
    setSearchFocused(false);
  };

  // OSRM Calculate Route
  const handleCalculateRoute = async (targetBiz: Business) => {
    let origin = userLocation;
    if (!origin) {
      origin = { lat: 23.1385, lng: -82.3842 };
      setUserLocation(origin);
      setUserLocationName('Vedado, La Habana (Referencia GPS)');
    }

    showToast(`🚗 Calculando ruta OSRM hacia ${targetBiz.name}...`);
    try {
      const result = await calculateOSRMRoute(origin, { lat: targetBiz.lat, lng: targetBiz.lng });
      if (result) {
        setActiveRoute({
          route: result,
          business: targetBiz
        });
        showToast(`✓ Ruta calculada: ${(result.distanceMeters / 1000).toFixed(1)} km`);
      } else {
        showToast('No se pudo trazar la ruta en este momento.');
      }
    } catch (e) {
      showToast('Error al conectar con el servidor OSRM.');
    }
  };

  // Vote on whether information is still accurate
  const handleVote = (bizId: string, isConfirm: boolean) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id === bizId) {
          return {
            ...b,
            confirmationsCount: isConfirm ? b.confirmationsCount + 1 : b.confirmationsCount,
            reportsCount: !isConfirm ? b.reportsCount + 1 : b.reportsCount,
            lastStatusUpdate: 'Confirmado recientemente'
          };
        }
        return b;
      })
    );
    void syncMutation(bizId, 'vote', { isConfirm });
    showToast(isConfirm ? '✓ Voto registrado: Confirmado activo hoy' : 'Reporte registrado para moderación');
  };

  // Toggle Transfer status (🟢 Disponible AHORA vs 🟡 Sin transfer)
  const handleToggleTransferActive = (bizId: string) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id === bizId) {
          const newStatus = !b.transferActiveNow;
          return {
            ...b,
            transferActiveNow: newStatus,
            lastStatusUpdate: 'Hace un momento'
          };
        }
        return b;
      })
    );

    if (selectedBusiness && selectedBusiness.id === bizId) {
      setSelectedBusiness((prev) =>
        prev
          ? {
              ...prev,
              transferActiveNow: !prev.transferActiveNow,
              lastStatusUpdate: 'Hace un momento'
            }
          : null
      );
    }
    void syncMutation(bizId, 'toggleTransferActive');
    showToast('Estado de transferencia en vivo actualizado');
  };

  // Report issue with business
  const handleReport = (bizId: string, reason: string) => {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === bizId ? { ...b, reportsCount: b.reportsCount + 1 } : b))
    );
    void syncMutation(bizId, 'report');
    showToast(`✓ Reporte enviado al equipo TransferCuba: "${reason.slice(0, 30)}..."`);
  };

  // Register New Business — escribe vía API (PostGIS / in-memory) y, en éxito,
  // usa el negocio DEVUELTO por el server (id `biz-*` canónico + status pending)
  // para que los PATCH admin posteriores no fallen por ids divergentes.
  // Sin red (Cuba offline): respaldo local con id propio, sync diferida.
  const handleRegisterBusiness = async (data: Partial<Business>) => {
    const localBiz: Business = {
      id: `tc-biz-${Date.now()}`,
      name: data.name || 'Nuevo Negocio',
      category: data.category || 'tiendas',
      categoryIcon: data.categoryIcon || '🏪',
      description: data.description || '',
      province: data.province || selectedProvince,
      municipality: data.municipality || 'Playa',
      neighborhood: data.neighborhood || '',
      address: data.address || '',
      lat: data.lat || mapCenter[0],
      lng: data.lng || mapCenter[1],
      acceptsTransfer: true,
      transferActiveNow: data.transferActiveNow ?? true,
      transferDetails: data.transferDetails || {
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
      hours: data.hours || '8:30 AM - 6:00 PM',
      whatsapp: data.whatsapp || '',
      phone: data.phone || '',
      rating: 5.0,
      reviewsCount: 1,
      photos: data.photos ?? [],
      featured: false,
      status: 'pending'
    };

    let createdViaApi = false;
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localBiz)
      });
      if (res.ok) {
        const payload = (await res.json()) as { success?: boolean; business?: Business };
        if (payload.success && payload.business) {
          setBusinesses((prev) => [payload.business as Business, ...prev]);
          createdViaApi = true;
        }
      }
    } catch {
      // offline: persiste en cache local y la lista local lo muestra
    }

    if (!createdViaApi) setBusinesses((prev) => [localBiz, ...prev]);
    setIsRegisterModalOpen(false);
    setIsPinningMode(false);
    setPinLocation(null);

    showToast('🎉 ¡Negocio recibido! Queda 🟡 Pendiente de aprobación por un administrador antes de publicarse.');
  };

  // Handle Pinning Mode
  const handleStartPinning = () => {
    setIsRegisterModalOpen(false);
    setIsPinningMode(true);
    setPinLocation({ lat: mapCenter[0], lng: mapCenter[1] });
    showToast('📍 Haz clic en el mapa o arrastra el marcador verde hasta tu local.');
  };

  const handleConfirmPinLocation = () => {
    setIsPinningMode(false);
    setIsRegisterModalOpen(true);
    showToast('✓ Coordenadas exactas fijadas.');
  };

  // Aplica una transformación a un negocio en ambos estados (general + admin-override)
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

  // Admin Approval Actions
  const handleApproveBusiness = (bizId: string) => {
    let bizName = '';
    applyToStates(bizId, (b) => {
      bizName = b.name;
      return {
        ...b,
        status: 'active' as const,
        transferVerified: true,
        lastStatusUpdate: 'Aprobado y publicado por administración'
      };
    });
    void syncMutation(bizId, 'approve');
    showToast(`✓ ¡Negocio "${bizName || 'Comercio'}" aprobado y visible en el mapa!`);
  };

  const handleRejectBusiness = (bizId: string) => {
    let bizName = '';
    applyToStates(bizId, (b) => {
      bizName = b.name;
      return {
        ...b,
        status: 'rejected' as const,
        lastStatusUpdate: 'Rechazado por administración'
      };
    });
    void syncMutation(bizId, 'reject');
    showToast(`Negocio "${bizName || 'Comercio'}" rechazado.`);
  };

  // Admin Actions
  const handleToggleVerify = (bizId: string) => {
    applyToStates(bizId, (b) => ({
      ...b,
      transferVerified: !b.transferVerified,
      status: !b.transferVerified ? ('active' as const) : ('pending' as const)
    }));
    void syncMutation(bizId, 'verify');
    showToast('Estado de verificación TransferCuba actualizado');
  };

  const handleDeleteBusiness = (bizId: string) => {
    applyToStates(bizId, (b) => b, true);
    void syncMutation(bizId, 'delete');
    if (selectedBusiness?.id === bizId) {
      setSelectedBusiness(null);
    }
    showToast('Negocio eliminado');
  };

  const handleResetFilters = () => {
    setSelectedProvince('La Habana');
    setSelectedMunicipality('all');
    setSelectedCategory('all');
    setOnlyActiveNow(false);
    setOnlyTransfer(true);
    setFilterVerification('all');
    setFilterQr(false);
    setFilterOnline(false);
    setSearchQuery('');
    setMapCenter([23.1385, -82.3842]);
    setMapZoom(14);
    showToast('Filtros restablecidos');
  };

  // Check if any non-default filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      selectedCategory !== 'all' ||
      selectedProvince !== 'La Habana' ||
      selectedMunicipality !== 'all' ||
      onlyActiveNow ||
      !onlyTransfer ||
      filterQr ||
      filterOnline ||
      filterVerification !== 'all' ||
      searchQuery.trim() !== ''
    );
  }, [
    selectedCategory,
    selectedProvince,
    selectedMunicipality,
    onlyActiveNow,
    onlyTransfer,
    filterQr,
    filterOnline,
    filterVerification,
    searchQuery
  ]);

  // Filtered & Ranked Businesses calculation.
  // Sprint 3: el server ya aplicó filtros+bbox vía PostGIS; aquí solo
  // garantizamos status activo (defensa), admin-override y orden final.
  const filteredBusinesses = useMemo(() => {
    // Admin panel open: usar dataset completo (todos los status)
    let result = (adminAllBusinesses ?? businesses).filter((b) =>
      adminAllBusinesses ? true : b.status === 'active'
    );

    // 1. Filter by Province
    if (selectedProvince !== 'all') {
      result = result.filter(
        (b) => b.province.toLowerCase() === selectedProvince.toLowerCase()
      );
    }

    // 2. Filter by Municipality
    if (selectedMunicipality !== 'all') {
      result = result.filter(
        (b) => b.municipality.toLowerCase() === selectedMunicipality.toLowerCase()
      );
    }

    // 3. Filter by Category
    if (selectedCategory !== 'all') {
      result = result.filter((b) => b.category === selectedCategory);
    }

    // 4. Accepts transfer
    if (onlyTransfer) {
      result = result.filter((b) => b.acceptsTransfer);
    }

    // 5. Live active transfer status
    if (onlyActiveNow) {
      result = result.filter((b) => b.transferActiveNow);
    }

    // 6. QR / Online payment filters
    if (filterQr) {
      result = result.filter((b) => b.transferDetails?.qrPayment);
    }
    if (filterOnline) {
      result = result.filter((b) => b.transferDetails?.onlineGateway);
    }

    // 7. Verification Status (verified, pending, reported)
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

    // 8. Search Query
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

    // 9. Distance calculation & Sorting (PostGIS ST_Distance simulation)
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
    businesses,
    adminAllBusinesses,
    searchQuery,
    selectedProvince,
    selectedMunicipality,
    selectedCategory,
    onlyTransfer,
    onlyActiveNow,
    filterQr,
    filterOnline,
    filterVerification,
    userLocation
  ]);

  // Shared MapLibre Component instance
  const mapElement = (
    <MapErrorBoundary>
      <MapLibreMap
        businesses={filteredBusinesses}
        selectedBusiness={selectedBusiness}
        onSelectBusiness={handleSelectBusiness}
        center={mapCenter}
        zoom={mapZoom}
        userLocation={userLocation}
        isPinningMode={isPinningMode}
        pinLocation={pinLocation}
        onPinLocationChange={setPinLocation}
        onMapClick={(coords) => {
          if (isPinningMode) setPinLocation(coords);
        }}
        onClusterClick={handleClusterClick}
        onViewportChange={(bbox) => setViewportBbox(bbox)}
        routeGeometry={activeRoute?.route.geometry || null}
        mapRef={mapRef}
        onMapReady={() => setMapReady(true)}
      />
    </MapErrorBoundary>
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-canvas font-sans select-none">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-navy/95 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-lg shadow-level-3 border border-navy-hover flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none">
          <Sparkles className="w-4 h-4 text-emerald-brand flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Full-Screen Edge-to-Edge MapLibre GL JS + OSM Canvas */}
      <div className="absolute inset-0 w-full h-full z-0">
        {mapElement}
      </div>

      {/* Map Attribution Badge */}
      <div className="absolute bottom-2 left-2 z-10 hidden sm:flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md shadow-level-1 border border-border-subtle text-[10px] font-semibold text-text-muted pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-brand animate-pulse" />
        <span>MapLibre GL JS · OpenStreetMap · OSRM</span>
      </div>

      {/* 2. Google Maps Floating Top Bar with Search & Category / Verification Ribbon */}
      <GoogleMapsTopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onMenuClick={() => setIsSideDrawerOpen(true)}
        onNearMeClick={handleUseCurrentGps}
        hasUserLocation={userLocation !== null}
        isLocating={isLocating}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onlyActiveNow={onlyActiveNow}
        onToggleOnlyActiveNow={() => setOnlyActiveNow(!onlyActiveNow)}
        onlyTransfer={onlyTransfer}
        onToggleOnlyTransfer={() => setOnlyTransfer(!onlyTransfer)}
        filterVerification={filterVerification}
        onFilterVerificationChange={setFilterVerification}
        selectedProvince={selectedProvince}
        onProvinceClick={() => setIsLocationModalOpen(true)}
        onToggleFiltersModal={() => setIsFiltersModalOpen(true)}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        onAdminClick={() => setIsAdminModalOpen(true)}
        searchPlaces={geocodePlaces}
        isGeocoding={isGeocoding}
        searchFocused={searchFocused}
        onSearchFocusChange={setSearchFocused}
        searchSuggestions={filteredBusinesses.slice(0, 3)}
        onSelectPlace={handleSelectPlace}
        onSelectBusiness={handleSelectSearchBusiness}
      />

      {/* 3. Active OSRM Route Navigation Pill (Top Center) */}
      {activeRoute && (
        <RouteInfoBar
          route={activeRoute.route}
          business={activeRoute.business}
          onClearRoute={() => setActiveRoute(null)}
        />
      )}

      {/* 4. Desktop Google Maps Floating Panel (Hidden on Mobile) */}
      <GoogleMapsDesktopPanel
        businesses={filteredBusinesses}
        selectedBusiness={selectedBusiness}
        onSelectBusiness={handleSelectBusiness}
        onVote={handleVote}
        onToggleTransferActive={handleToggleTransferActive}
        onReport={handleReport}
        onCalculateRoute={handleCalculateRoute}
        hasUserLocation={userLocation !== null}
        isOpen={isDesktopPanelOpen}
        onToggleOpen={() => setIsDesktopPanelOpen(!isDesktopPanelOpen)}
      />

      {/* 5. Mobile Google Maps Bottom Sheet (Hidden on Desktop) */}
      <GoogleMapsMobileBottomSheet
        businesses={filteredBusinesses}
        selectedBusiness={selectedBusiness}
        onSelectBusiness={handleSelectBusiness}
        onVote={handleVote}
        onToggleTransferActive={handleToggleTransferActive}
        onReport={handleReport}
        onCalculateRoute={handleCalculateRoute}
        hasUserLocation={userLocation !== null}
        sheetState={mobileSheetState}
        onSheetStateChange={setMobileSheetState}
      />

      {/* 6. Google Maps Floating Controls (Bottom-Right: GPS Recenter + Zoom + "+ Registrar" FAB) */}
      <GoogleMapsFloatingControls
        onNearMeClick={handleUseCurrentGps}
        hasUserLocation={userLocation !== null}
        isLocating={isLocating}
        onRegisterClick={() => setIsRegisterModalOpen(true)}
        onProvinceClick={() => setIsLocationModalOpen(true)}
        selectedProvince={selectedProvince}
        hasBottomCardMobile={selectedBusiness !== null}
        sheetState={mobileSheetState}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        mapReady={mapReady}
        isFullscreen={isFullscreen}
        onFullscreenToggle={handleToggleFullscreen}
      />

      {/* Cluster card (Sprint 9): negocios agrupados al hacer clic en un cluster */}
      {clusterView && (
        <div className="fixed z-40 bottom-40 sm:bottom-44 left-1/2 -translate-x-1/2 w-[min(92vw,420px)] bg-white rounded-2xl border border-border-subtle shadow-level-4 overflow-hidden flex flex-col max-h-[42vh] animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="flex items-center justify-between gap-2 pl-4 pr-2 pt-2.5 pb-2 border-b border-border-subtle">
            <p className="text-sm font-bold text-text-primary truncate">
              Negocios en la zona ({clusterView.businesses.length}+)
            </p>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={handleExpandCluster}
                title="Acercar al grupo"
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[13px] font-semibold text-cerulean hover:bg-tm-bg active:scale-95 transition-all"
              >
                Ver mapa
              </button>
              <button
                onClick={handleCloseCluster}
                aria-label="Cerrar sugerencias del grupo"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto">
            {clusterView.businesses.map((b) => (
              <button
                key={b.id}
                onClick={() => handleSelectBusiness(b)}
                className="w-full flex items-center gap-3 px-4 py-2 min-h-[52px] text-left hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-border-subtle last:border-0"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-tm-bg text-lg flex-shrink-0 shrink-0">
                  {CATEGORY_EMOJI[b.category] ?? '📍'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary truncate">
                    {b.name}
                    {b.transferActiveNow && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-brand flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-brand animate-pulse" />
                        Activo
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {b.neighborhood ?? b.municipality} ·{' '}
                    {CATEGORIES.find((c) => c.id === b.category)?.label ?? b.category}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pinning Mode Confirmation Floating Control */}
      {isPinningMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white p-3 rounded-xl shadow-level-4 border border-border-subtle animate-in slide-in-from-bottom-5">
          <button
            onClick={handleConfirmPinLocation}
            className="px-5 py-2.5 bg-emerald-brand hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-lg shadow-level-1 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Confirmar esta ubicación</span>
          </button>
          <button
            onClick={() => {
              setIsPinningMode(false);
              setIsRegisterModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-lg"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Mobile Drawer (Menu) */}
      <GoogleMapsSideDrawer
        isOpen={isSideDrawerOpen}
        onClose={() => setIsSideDrawerOpen(false)}
        selectedProvince={selectedProvince}
        onProvinceChange={handleProvinceChange}
        onNearMeClick={handleUseCurrentGps}
        onRegisterClick={() => setIsRegisterModalOpen(true)}
        onAdminClick={() => setIsAdminModalOpen(true)}
        totalBusinesses={businesses.length}
      />

      {/* Advanced Filters Modal (Categories, Municipalities, Verification, Channels) */}
      <GoogleMapsFiltersModal
        isOpen={isFiltersModalOpen}
        onClose={() => setIsFiltersModalOpen(false)}
        selectedProvince={selectedProvince}
        onProvinceChange={handleProvinceChange}
        selectedMunicipality={selectedMunicipality}
        onMunicipalityChange={setSelectedMunicipality}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onlyActiveNow={onlyActiveNow}
        onToggleOnlyActiveNow={() => setOnlyActiveNow(!onlyActiveNow)}
        onlyTransfer={onlyTransfer}
        onToggleOnlyTransfer={() => setOnlyTransfer(!onlyTransfer)}
        filterQr={filterQr}
        onToggleFilterQr={() => setFilterQr(!filterQr)}
        filterOnline={filterOnline}
        onToggleFilterOnline={() => setFilterOnline(!filterOnline)}
        filterVerification={filterVerification}
        onFilterVerificationChange={setFilterVerification}
        onResetFilters={handleResetFilters}
        totalResults={filteredBusinesses.length}
      />

      {/* Register Business Modal with Nominatim OSM Assistant and Pinning */}
      <RegisterBusinessModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSubmit={handleRegisterBusiness}
        pinLocation={pinLocation}
        onStartPinning={handleStartPinning}
        onPinLocationChange={setPinLocation}
      />

      {/* Location Picker Modal (Near Me GPS & Preset Cities) */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSelectCoordinates={handleSelectPresetLocation}
        onUseCurrentGps={handleUseCurrentGps}
        isLocating={isLocating}
      />

      {/* DevParadise Admin Dashboard Modal */}
      <AdminDashboardModal
        isOpen={isAdminModalOpen}
        onOpen={fetchAdminAll}
        onClose={() => {
          handleAdminClose();
          setIsAdminModalOpen(false);
        }}
        businesses={businesses}
        onToggleVerify={handleToggleVerify}
        onToggleTransferActive={handleToggleTransferActive}
        onDeleteBusiness={handleDeleteBusiness}
        onSelectBusiness={handleSelectBusiness}
        onApproveBusiness={handleApproveBusiness}
        onRejectBusiness={handleRejectBusiness}
      />
    </main>
  );
}
