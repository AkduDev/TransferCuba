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
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-xs shadow-xl shadow-slate-950/20 border border-slate-800 hover:border-emerald-500/50 active:scale-95 transition-all group"
        title="Registrar mi negocio gratis"
      >
        <PlusCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span className="font-display">+ Registrar</span>
      </button>

      {/* GPS Locate / My Location Circular Button */}
      <button
        onClick={onNearMeClick}
        id="fab-gm-gps"
        aria-label="Centrar en mi ubicación"
        className={`w-11 h-11 rounded-full bg-white shadow-xl shadow-slate-900/15 border flex items-center justify-center active:scale-90 transition-all ${
          hasUserLocation 
            ? 'text-blue-600 border-blue-400 ring-2 ring-blue-400/30' 
            : 'text-slate-700 hover:text-slate-950 border-slate-200 hover:bg-slate-50'
        }`}
        title={hasUserLocation ? 'Ubicación GPS fijada' : 'Centrar en mi ubicación'}
      >
        <Navigation className={`w-5 h-5 ${isLocating ? 'animate-spin text-emerald-600' : ''}`} />
      </button>
    </div>
  );
}
