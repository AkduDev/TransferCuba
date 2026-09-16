import { useState, useCallback } from 'react';

export interface GeolocationState {
  userLocation: { lat: number; lng: number } | null;
  userLocationName: string;
  isLocating: boolean;
  setUserLocation: (c: { lat: number; lng: number } | null) => void;
  setUserLocationName: (n: string) => void;
  setIsLocating: (v: boolean) => void;
  handleUseCurrentGps: () => void;
  handleSelectPresetLocation: (coords: { lat: number; lng: number }, name: string) => void;
}

export function useGeolocation(
  centerOn: (lat: number, lng: number, zoom: number) => void,
  closeLocationModal: () => void,
  showToast: (msg: string) => void
): GeolocationState {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationName, setUserLocationName] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const handleUseCurrentGps = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Tu navegador no soporta geolocalizaci\u00f3n.');
      return;
    }
    if (userLocation) {
      centerOn(userLocation.lat, userLocation.lng, 15);
      closeLocationModal();
      showToast('\u{1F4CD} Re-centrado en tu ubicaci\u00f3n GPS.');
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(coords);
        setUserLocationName('Tu ubicaci\u00f3n GPS');
        centerOn(coords.lat, coords.lng, 15);
        setIsLocating(false);
        closeLocationModal();
        showToast('\u{1F4CD} Ubicaci\u00f3n GPS actualizada. Negocios ordenados por cercan\u00eda.');
      },
      (error) => {
        setIsLocating(false);
        closeLocationModal();
        if (!userLocation) {
          const defaultPreset = { lat: 23.1385, lng: -82.3842 };
          setUserLocation(defaultPreset);
          setUserLocationName('Vedado, La Habana');
          centerOn(defaultPreset.lat, defaultPreset.lng, 14);
        }
        const denied = error.code === error.PERMISSION_DENIED;
        showToast(
          denied
            ? 'Sin permiso de ubicaci\u00f3n. Concede acceso e int\u00e9ntalo de nuevo.'
            : 'GPS no disponible ahora (se\u00f1al/timeout). Reintenta.'
        );
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [userLocation, centerOn, closeLocationModal, showToast]);

  const handleSelectPresetLocation = useCallback(
    (coords: { lat: number; lng: number }, name: string) => {
      setUserLocation(coords);
      setUserLocationName(name);
      centerOn(coords.lat, coords.lng, 15);
      showToast(`\u{1F4CD} Ubicaci\u00f3n fijada en ${name}. Negocios ordenados por proximidad.`);
    },
    [centerOn, showToast]
  );

  return {
    userLocation, userLocationName, isLocating,
    setUserLocation, setUserLocationName, setIsLocating,
    handleUseCurrentGps, handleSelectPresetLocation
  };
}