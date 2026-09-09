'use client';

import React from 'react';
import { 
  Navigation, 
  PlusCircle, 
  MapPin, 
  Layers, 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

interface GoogleMapsFloatingControlsProps {
  onNearMeClick: () => void;
  hasUserLocation: boolean;
  isLocating: boolean;
  onRegisterClick: () => void;
  onProvinceClick: () => void;
  selectedProvince: string;
  hasBottomCardMobile: boolean;
  sheetState?: 'peek' | 'half' | 'full';
}

export default function GoogleMapsFloatingControls({
  onNearMeClick,
  hasUserLocation,
  isLocating,
  onRegisterClick,
  onProvinceClick,
  selectedProvince,
  hasBottomCardMobile,
  sheetState = 'peek'
}: GoogleMapsFloatingControlsProps) {
  // Determine mobile bottom positioning with safe-area insets
  const mobilePositionClasses = (() => {
    if (sheetState === 'half' || sheetState === 'full') {
      return 'opacity-0 pointer-events-none translate-y-4';
    }
    if (hasBottomCardMobile) {
      return 'bottom-[calc(224px+env(safe-area-inset-bottom,0px))] opacity-100 pointer-events-auto translate-y-0';
    }
    return 'bottom-[calc(82px+env(safe-area-inset-bottom,0px))] opacity-100 pointer-events-auto translate-y-0';
  })();

  return (
    <div
      className={`fixed right-3 md:right-5 z-20 flex flex-col items-end gap-2.5 transition-all duration-300 ${mobilePositionClasses} md:bottom-6 md:opacity-100 md:pointer-events-auto md:translate-y-0`}
    >
      {/* Quick Add Business Floating Action Button */}
      <button
        onClick={onRegisterClick}
        id="fab-gm-register"
        className="flex items-center gap-2 px-4 h-11 rounded-full bg-navy hover:bg-navy-hover text-white font-bold text-xs shadow-level-2 border border-navy-hover active:scale-95 transition-all"
        title="Registrar mi negocio gratis"
      >
        <PlusCircle className="w-4 h-4 text-emerald-brand" />
        <span>Registrar</span>
      </button>

      {/* GPS Locate / My Location Circular Button */}
      <button
        onClick={onNearMeClick}
        id="fab-gm-gps"
        aria-label="Centrar en mi ubicación"
        className={`w-11 h-11 rounded-full bg-white shadow-level-2 border flex items-center justify-center active:scale-90 transition-all ${
          hasUserLocation
            ? 'text-cerulean border-cerulean ring-2 ring-cerulean/25'
            : 'text-slate-600 hover:text-navy border-border-subtle hover:bg-slate-50'
        }`}
        title={hasUserLocation ? 'Ubicación GPS fijada' : 'Centrar en mi ubicación'}
      >
        <Navigation className={`w-5 h-5 ${isLocating ? 'animate-spin text-cerulean' : ''}`} />
      </button>
    </div>
  );
}
