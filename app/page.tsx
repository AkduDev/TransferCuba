'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  calculateDistanceMeters 
} from '@/lib/cuba-data';
import { calculateOSRMRoute, OSRMRouteResult } from '@/lib/osrm';
import { 
  Check, 
  Sparkles,
  MapPin,
  ShieldCheck
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
  // Persistence state
  const [businesses, setBusinesses] = useState<Business[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('transfercuba_businesses_v2');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return INITIAL_BUSINESSES;
  });

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('transfercuba_businesses_v2', JSON.stringify(businesses));
    }
  }, [businesses]);

  // Search & Filter states matching the ASCII wireframe
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('La Habana');
  const [selectedMunicipality, setSelectedMunicipality] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [onlyTransfer, setOnlyTransfer] = useState(true);
  const [onlyActiveNow, setOnlyActiveNow] = useState(false);
  const [filterVerification, setFilterVerification] = useState('all'); // 'all' | 'verified' | 'pending' | 'reported'
  const [filterQr, setFilterQr] = useState(false);
  const [filterOnline, setFilterOnline] = useState(false);

  // Desktop Panel & Modals state
  const [isDesktopPanelOpen, setIsDesktopPanelOpen] = useState(true);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);

  // Selected Business
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  // User location / GPS state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
        showToast('📍 Ubicación detectada. Negocios ordenados por cercanía.');
      },
      (error) => {
        setIsLocating(false);
        const defaultPreset = { lat: 23.1385, lng: -82.3842 };
        setUserLocation(defaultPreset);
        setUserLocationName('Vedado, La Habana');
        setMapCenter([defaultPreset.lat, defaultPreset.lng]);
        setMapZoom(14);
        setIsLocationModalOpen(false);
        showToast('Ubicación fijada en Vedado, La Habana (referencia cubana).');
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

  // Select Business from list or map
  const handleSelectBusiness = (business: Business | null) => {
    setSelectedBusiness(business);
    if (business) {
      setMapCenter([business.lat, business.lng]);
      setMapZoom(16);
      setIsDesktopPanelOpen(true);
      setMobileSheetState('peek');
    }
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
    showToast('Estado de transferencia en vivo actualizado');
  };

  // Report issue with business
  const handleReport = (bizId: string, reason: string) => {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === bizId ? { ...b, reportsCount: b.reportsCount + 1 } : b))
    );
    showToast(`✓ Reporte enviado al equipo TransferCuba: "${reason.slice(0, 30)}..."`);
  };

  // Register New Business
  const handleRegisterBusiness = (data: Partial<Business>) => {
    const newBiz: Business = {
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
      photos: data.photos && data.photos.length > 0 ? data.photos : ['https://picsum.photos/seed/cuba-biz/600/400'],
      featured: false,
      status: 'pending'
    };

    setBusinesses((prev) => [newBiz, ...prev]);
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

  // Admin Approval Actions
  const handleApproveBusiness = (bizId: string) => {
    let bizName = '';
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id === bizId) {
          bizName = b.name;
          return {
            ...b,
            status: 'active',
            transferVerified: true,
            lastStatusUpdate: 'Aprobado y publicado por administración'
          };
        }
        return b;
      })
    );
    showToast(`✓ ¡Negocio "${bizName || 'Comercio'}" aprobado y visible en el mapa!`);
  };

  const handleRejectBusiness = (bizId: string) => {
    let bizName = '';
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id === bizId) {
          bizName = b.name;
          return {
            ...b,
            status: 'rejected',
            lastStatusUpdate: 'Rechazado por administración'
          };
        }
        return b;
      })
    );
    showToast(`Negocio "${bizName || 'Comercio'}" rechazado.`);
  };

  // Admin Actions
  const handleToggleVerify = (bizId: string) => {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === bizId ? { ...b, transferVerified: !b.transferVerified, status: !b.transferVerified ? 'active' : 'pending' } : b))
    );
    showToast('Estado de verificación TransferCuba actualizado');
  };

  const handleDeleteBusiness = (bizId: string) => {
    setBusinesses((prev) => prev.filter((b) => b.id !== bizId));
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

  // Filtered & Ranked Businesses calculation (PostGIS ST_DWithin simulation)
  const filteredBusinesses = useMemo(() => {
    // 0. Only show businesses that have been approved by an administrator
    let result = businesses.filter((b) => b.status === 'active');

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
        routeGeometry={activeRoute?.route.geometry || null}
      />
    </MapErrorBoundary>
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Full-Screen Edge-to-Edge MapLibre GL JS + OSM Canvas */}
      <div className="absolute inset-0 w-full h-full z-0">
        {mapElement}
      </div>

      {/* Map Attribution Badge */}
      <div className="absolute bottom-2 left-2 z-10 hidden sm:flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 text-[10px] font-semibold text-slate-600 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>MapLibre GL JS · OpenStreetMap Cuba · OSRM</span>
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

      {/* 6. Google Maps Floating Controls (Bottom-Right: GPS Recenter + "+ Registrar" FAB) */}
      <GoogleMapsFloatingControls
        onNearMeClick={handleUseCurrentGps}
        hasUserLocation={userLocation !== null}
        isLocating={isLocating}
        onRegisterClick={() => setIsRegisterModalOpen(true)}
        onProvinceClick={() => setIsLocationModalOpen(true)}
        selectedProvince={selectedProvince}
        hasBottomCardMobile={selectedBusiness !== null}
        sheetState={mobileSheetState}
      />

      {/* Pinning Mode Confirmation Floating Control */}
      {isPinningMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white p-3 rounded-2xl shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-5">
          <button
            onClick={handleConfirmPinLocation}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Confirmar esta ubicación</span>
          </button>
          <button
            onClick={() => {
              setIsPinningMode(false);
              setIsRegisterModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl"
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
        onClose={() => setIsAdminModalOpen(false)}
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
