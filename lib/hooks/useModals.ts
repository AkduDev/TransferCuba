import { useState, useCallback } from 'react';

export interface ModalsState {
  isDesktopPanelOpen: boolean;
  setIsDesktopPanelOpen: (v: boolean) => void;
  isFiltersModalOpen: boolean;
  setIsFiltersModalOpen: (v: boolean) => void;
  isSideDrawerOpen: boolean;
  setIsSideDrawerOpen: (v: boolean) => void;
  isRegisterModalOpen: boolean;
  setIsRegisterModalOpen: (v: boolean) => void;
  isAdminModalOpen: boolean;
  setIsAdminModalOpen: (v: boolean) => void;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (v: boolean) => void;
  mobileSheetState: 'peek' | 'half' | 'full';
  setMobileSheetState: (s: 'peek' | 'half' | 'full') => void;
  isPinningMode: boolean;
  setIsPinningMode: (v: boolean) => void;
  pinLocation: { lat: number; lng: number } | null;
  setPinLocation: (c: { lat: number; lng: number } | null) => void;
  handleStartPinning: (mapCenter: [number, number], showToast: (msg: string) => void) => void;
  handleConfirmPinLocation: (showToast: (msg: string) => void) => void;
}

export function useModals(): ModalsState {
  const [isDesktopPanelOpen, setIsDesktopPanelOpen] = useState(true);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [mobileSheetState, setMobileSheetState] = useState<'peek' | 'half' | 'full'>('peek');
  const [isPinningMode, setIsPinningMode] = useState(false);
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleStartPinning = useCallback(
    (mapCenter: [number, number], showToast: (msg: string) => void) => {
      setIsRegisterModalOpen(false);
      setIsPinningMode(true);
      setPinLocation({ lat: mapCenter[0], lng: mapCenter[1] });
      showToast('\u{1F4CD} Haz clic en el mapa o arrastra el marcador verde hasta tu local.');
    },
    []
  );

  const handleConfirmPinLocation = useCallback((showToast: (msg: string) => void) => {
    setIsPinningMode(false);
    setIsRegisterModalOpen(true);
    showToast('\u2713 Coordenadas exactas fijadas.');
  }, []);

  return {
    isDesktopPanelOpen, setIsDesktopPanelOpen,
    isFiltersModalOpen, setIsFiltersModalOpen,
    isSideDrawerOpen, setIsSideDrawerOpen,
    isRegisterModalOpen, setIsRegisterModalOpen,
    isAdminModalOpen, setIsAdminModalOpen,
    isLocationModalOpen, setIsLocationModalOpen,
    mobileSheetState, setMobileSheetState,
    isPinningMode, setIsPinningMode, pinLocation, setPinLocation,
    handleStartPinning, handleConfirmPinLocation
  };
}
