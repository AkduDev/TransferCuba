'use client';

import dynamic from 'next/dynamic';
import GoogleMapsTopBar from '@/components/GoogleMapsTopBar';
import GoogleMapsDesktopPanel from '@/components/GoogleMapsDesktopPanel';
import GoogleMapsMobileBottomSheet from '@/components/GoogleMapsMobileBottomSheet';
import GoogleMapsFloatingControls from '@/components/GoogleMapsFloatingControls';
import GoogleMapsFiltersModal from '@/components/GoogleMapsFiltersModal';
import GoogleMapsSideDrawer from '@/components/GoogleMapsSideDrawer';
import GoogleMapsClusterCard from '@/components/GoogleMapsClusterCard';
import GoogleMapsPinningControls from '@/components/GoogleMapsPinningControls';
import GoogleMapsToast from '@/components/GoogleMapsToast';
import GoogleMapsAttribution from '@/components/GoogleMapsAttribution';
import RouteInfoBar from '@/components/RouteInfoBar';
import RegisterBusinessModal from '@/components/RegisterBusinessModal';
import AdminDashboardModal from '@/components/AdminDashboardModal';
import GoogleMapsAuthModal from '@/components/GoogleMapsAuthModal';
import LocationPickerModal from '@/components/LocationPickerModal';
import GoogleMapsDeliveryModal from '@/components/GoogleMapsDeliveryModal';
import GoogleMapsMessengerModal from '@/components/GoogleMapsMessengerModal';
import MapErrorBoundary from '@/components/MapErrorBoundary';
import type { Business } from '@/lib/cuba-data';
import { useToast } from '@/lib/hooks/useToast';
import { useMapViewport } from '@/lib/hooks/useMapViewport';
import { useFilters } from '@/lib/hooks/useFilters';
import { useGeolocation } from '@/lib/hooks/useGeolocation';
import { useGeocoding } from '@/lib/hooks/useGeocoding';
import { useBusinessesData } from '@/lib/hooks/useBusinessesData';
import { useBusinessActions } from '@/lib/hooks/useBusinessActions';
import { useModals } from '@/lib/hooks/useModals';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDeliveries } from '@/lib/hooks/useDeliveries';
import { useMessengerApplication } from '@/lib/hooks/useMessengerApplication';

const MapLibreMap = dynamic(() => import('@/components/MapLibreMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      <p className="text-xs sm:text-sm font-semibold text-slate-700">Iniciando MapLibre GL JS + OpenStreetMap Cuba...</p>
    </div>
  )
});

export default function Home() {
  const { toastMessage, showToast } = useToast();
  const vp = useMapViewport(showToast);
  const fl = useFilters(vp.centerOn, showToast);
  const ui = useModals();
  const geo = useGeolocation(vp.centerOn, () => ui.setIsLocationModalOpen(false), showToast);
  const gc = useGeocoding(fl.searchQuery, fl.selectedProvince, fl.setSearchQuery, vp.centerOn, showToast);
  const data = useBusinessesData({
    filters: { searchQuery: fl.searchQuery, selectedProvince: fl.selectedProvince, selectedMunicipality: fl.selectedMunicipality, selectedCategory: fl.selectedCategory, onlyTransfer: fl.onlyTransfer, onlyActiveNow: fl.onlyActiveNow, filterVerification: fl.filterVerification, filterQr: fl.filterQr, filterOnline: fl.filterOnline },
    viewportBbox: vp.viewportBbox,
    userLocation: geo.userLocation
  });
  const actions = useBusinessActions({ setBusinesses: data.setBusinesses, syncMutation: data.syncMutation, applyToStates: data.applyToStates, userLocation: geo.userLocation, setUserLocation: geo.setUserLocation, setUserLocationName: geo.setUserLocationName, centerOn: vp.centerOn, mapRef: vp.mapRef, showToast });
  const auth = useAuth();
  const deliveries = useDeliveries({ showToast, role: auth.user?.role ?? null });
  const messengerApplication = useMessengerApplication({ isOpen: ui.isMessengerModalOpen, user: auth.user, onRoleChange: auth.refresh });
  const mapActiveTrip = deliveries.requesterActive ?? deliveries.messengerActive;

  const onSelectBiz = (b: Business) => { actions.handleSelectBusiness(b); ui.setIsDesktopPanelOpen(true); ui.setMobileSheetState('peek'); };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-canvas font-sans select-none">
      {toastMessage && <GoogleMapsToast message={toastMessage} />}

      <div className="absolute inset-0 w-full h-full z-0">
        <MapErrorBoundary>
          <MapLibreMap businesses={data.filteredBusinesses} selectedBusiness={actions.selectedBusiness} onSelectBusiness={onSelectBiz} center={vp.mapCenter} zoom={vp.mapZoom} userLocation={geo.userLocation} isPinningMode={ui.isPinningMode} pinLocation={ui.pinLocation} onPinLocationChange={ui.setPinLocation} onMapClick={(c) => { if (deliveries.picking) { deliveries.setPickedPoint(c); } else if (ui.isPinningMode) { ui.setPinLocation(c); } }} onClusterClick={actions.handleClusterClick} onViewportChange={vp.setViewportBbox} routeGeometry={actions.activeRoute?.route.geometry || null} mapRef={vp.mapRef} onMapReady={() => vp.setMapReady(true)} deliveryPickup={deliveries.pickup} deliveryDropoff={deliveries.dropoff} deliveryPicking={deliveries.picking} deliveryRequests={deliveries.isMessenger ? deliveries.messengerAvailable : []} activeDeliveryTrip={mapActiveTrip ? { pickup: mapActiveTrip.pickup, dropoff: mapActiveTrip.dropoff, status: mapActiveTrip.status } : undefined} onDeliveryRequestClick={() => ui.setIsMessengerModalOpen(true)} />
        </MapErrorBoundary>
      </div>

      <GoogleMapsAttribution />

      <GoogleMapsTopBar searchQuery={fl.searchQuery} onSearchChange={fl.setSearchQuery} onMenuClick={() => ui.setIsSideDrawerOpen(true)} onNearMeClick={geo.handleUseCurrentGps} hasUserLocation={geo.userLocation !== null} isLocating={geo.isLocating} selectedCategory={fl.selectedCategory} onCategoryChange={fl.setSelectedCategory} onlyActiveNow={fl.onlyActiveNow} onToggleOnlyActiveNow={() => fl.setOnlyActiveNow(!fl.onlyActiveNow)} onlyTransfer={fl.onlyTransfer} onToggleOnlyTransfer={() => fl.setOnlyTransfer(!fl.onlyTransfer)} selectedProvince={fl.selectedProvince} onProvinceClick={() => ui.setIsLocationModalOpen(true)} onToggleFiltersModal={() => ui.setIsFiltersModalOpen(true)} hasActiveFilters={fl.hasActiveFilters} onResetFilters={fl.handleResetFilters} onAdminClick={() => ui.setIsAdminModalOpen(true)} onAccountClick={() => ui.setIsAuthModalOpen(true)} searchPlaces={gc.geocodePlaces} isGeocoding={gc.isGeocoding} searchFocused={gc.searchFocused} onSearchFocusChange={gc.setSearchFocused} searchSuggestions={data.filteredBusinesses.slice(0, 3)} onSelectPlace={gc.handleSelectPlace} onSelectBusiness={actions.handleSelectSearchBusiness} />

      {actions.activeRoute && <RouteInfoBar route={actions.activeRoute.route} business={actions.activeRoute.business} onClearRoute={() => actions.setActiveRoute(null)} />}

      <GoogleMapsDesktopPanel businesses={data.filteredBusinesses} selectedBusiness={actions.selectedBusiness} onSelectBusiness={actions.handleSelectBusiness} onVote={actions.handleVote} onToggleTransferActive={actions.handleToggleTransferActive} onReport={actions.handleReport} onCalculateRoute={actions.handleCalculateRoute} hasUserLocation={geo.userLocation !== null} isOpen={ui.isDesktopPanelOpen} onToggleOpen={() => ui.setIsDesktopPanelOpen(!ui.isDesktopPanelOpen)} />

      <GoogleMapsMobileBottomSheet businesses={data.filteredBusinesses} selectedBusiness={actions.selectedBusiness} onSelectBusiness={actions.handleSelectBusiness} onVote={actions.handleVote} onToggleTransferActive={actions.handleToggleTransferActive} onReport={actions.handleReport} onCalculateRoute={actions.handleCalculateRoute} hasUserLocation={geo.userLocation !== null} sheetState={ui.mobileSheetState} onSheetStateChange={ui.setMobileSheetState} />

      <GoogleMapsFloatingControls onNearMeClick={geo.handleUseCurrentGps} hasUserLocation={geo.userLocation !== null} isLocating={geo.isLocating} onRegisterClick={() => ui.setIsRegisterModalOpen(true)} onProvinceClick={() => ui.setIsLocationModalOpen(true)} selectedProvince={fl.selectedProvince} hasBottomCardMobile={actions.selectedBusiness !== null} sheetState={ui.mobileSheetState} onZoomIn={vp.handleZoomIn} onZoomOut={vp.handleZoomOut} mapReady={vp.mapReady} isFullscreen={vp.isFullscreen} onFullscreenToggle={vp.handleToggleFullscreen} />

      {actions.clusterView && <GoogleMapsClusterCard cluster={actions.clusterView} visibleCount={actions.clusterVisibleCount} onSelectBusiness={actions.handleSelectBusiness} onExpand={actions.handleExpandCluster} onClose={actions.handleCloseCluster} onShowMore={() => actions.setClusterVisibleCount((n) => n + 8)} />}

      {ui.isPinningMode && <GoogleMapsPinningControls onConfirm={() => ui.handleConfirmPinLocation(showToast)} onCancel={() => { ui.setIsPinningMode(false); ui.setIsRegisterModalOpen(true); }} />}

      <GoogleMapsSideDrawer isOpen={ui.isSideDrawerOpen} onClose={() => ui.setIsSideDrawerOpen(false)} selectedProvince={fl.selectedProvince} onProvinceChange={fl.handleProvinceChange} onNearMeClick={geo.handleUseCurrentGps} onRegisterClick={() => ui.setIsRegisterModalOpen(true)} onAdminClick={() => ui.setIsAdminModalOpen(true)} onAccountClick={() => ui.setIsAuthModalOpen(true)} onDeliveryClick={() => ui.setIsDeliveryModalOpen(true)} onMessengerClick={() => ui.setIsMessengerModalOpen(true)} authUser={auth.user} totalBusinesses={data.businesses.length} />

      <GoogleMapsFiltersModal isOpen={ui.isFiltersModalOpen} onClose={() => ui.setIsFiltersModalOpen(false)} selectedProvince={fl.selectedProvince} onProvinceChange={fl.handleProvinceChange} selectedMunicipality={fl.selectedMunicipality} onMunicipalityChange={fl.setSelectedMunicipality} selectedCategory={fl.selectedCategory} onCategoryChange={fl.setSelectedCategory} onlyActiveNow={fl.onlyActiveNow} onToggleOnlyActiveNow={() => fl.setOnlyActiveNow(!fl.onlyActiveNow)} onlyTransfer={fl.onlyTransfer} onToggleOnlyTransfer={() => fl.setOnlyTransfer(!fl.onlyTransfer)} filterQr={fl.filterQr} onToggleFilterQr={() => fl.setFilterQr(!fl.filterQr)} filterOnline={fl.filterOnline} onToggleFilterOnline={() => fl.setFilterOnline(!fl.filterOnline)} filterVerification={fl.filterVerification} onFilterVerificationChange={fl.setFilterVerification} onResetFilters={fl.handleResetFilters} totalResults={data.filteredBusinesses.length} />

      <RegisterBusinessModal isOpen={ui.isRegisterModalOpen} onClose={() => ui.setIsRegisterModalOpen(false)} onSubmit={(d) => actions.handleRegisterBusiness(d, fl.selectedProvince, vp.mapCenter)} pinLocation={ui.pinLocation} onStartPinning={() => ui.handleStartPinning(vp.mapCenter, showToast)} onPinLocationChange={ui.setPinLocation} />

      <LocationPickerModal isOpen={ui.isLocationModalOpen} onClose={() => ui.setIsLocationModalOpen(false)} onSelectCoordinates={geo.handleSelectPresetLocation} onUseCurrentGps={geo.handleUseCurrentGps} isLocating={geo.isLocating} />

      <AdminDashboardModal isOpen={ui.isAdminModalOpen} onOpen={data.fetchAdminAll} onClose={() => { data.handleAdminClose(); ui.setIsAdminModalOpen(false); }} businesses={data.businesses} onToggleVerify={actions.handleToggleVerify} onToggleTransferActive={actions.handleToggleTransferActive} onDeleteBusiness={actions.handleDeleteBusiness} onSelectBusiness={actions.handleSelectBusiness} onApproveBusiness={actions.handleApproveBusiness} onRejectBusiness={actions.handleRejectBusiness} />

      <GoogleMapsAuthModal isOpen={ui.isAuthModalOpen} onClose={() => ui.setIsAuthModalOpen(false)} auth={auth} />

      <GoogleMapsDeliveryModal isOpen={ui.isDeliveryModalOpen} onClose={() => ui.setIsDeliveryModalOpen(false)} onOpenAuth={() => ui.setIsAuthModalOpen(true)} user={auth.user} userLocation={geo.userLocation} deliveries={deliveries} pickFromUserLocation={() => { if (geo.userLocation) deliveries.setPickupFromCoords(geo.userLocation); }} />

      <GoogleMapsMessengerModal isOpen={ui.isMessengerModalOpen} onClose={() => ui.setIsMessengerModalOpen(false)} onOpenAuth={() => ui.setIsAuthModalOpen(true)} user={auth.user} deliveries={deliveries} application={messengerApplication} />
    </main>
  );
}