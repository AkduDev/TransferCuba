'use client';

import React from 'react';
import { 
  Navigation, 
  PlusCircle, 
  Plus,
  Minus,
  Maximize,
  Minimize
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
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  mapReady?: boolean;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
}

function iconButtonClass(active: boolean): string {
  return `w-11 h-11 rounded-full bg-white shadow-level-2 border flex items-center justify-center active:scale-90 transition-all ${
    active
      ? 'text-cerulean border-cerulean ring-2 ring-cerulean/25'
      : 'text-slate-600 hover:text-navy border-border-subtle hover:bg-slate-50'
  }`;
}

export default function GoogleMapsFloatingControls({
  onNearMeClick,
  hasUserLocation,
  isLocating,
  onRegisterClick,
  onProvinceClick,
  selectedProvince,
  hasBottomCardMobile,
  sheetState = 'peek',
  onZoomIn,
  onZoomOut,
  mapReady = false,
  isFullscreen = false,
  onFullscreenToggle
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

  const zoomDisabled = !mapReady;

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

      {/* GPS Locate / My Location Circular Button (re-centra y refresca) */}
      <button
        onClick={onNearMeClick}
        id="fab-gm-gps"
        aria-label="Centrar en mi ubicación"
        className={iconButtonClass(hasUserLocation)}
        title={hasUserLocation ? 'Re-centrar en mi ubicación GPS' : 'Centrar en mi ubicación'}
      >
        <Navigation className={`w-5 h-5 ${isLocating ? 'animate-spin text-cerulean' : ''}`} />
      </button>

      {/* Zoom controls — vertical Google Maps-style pill */}
      {(onZoomIn || onZoomOut) && (
        <div className="flex flex-col items-center bg-white rounded-xl shadow-level-2 border border-border-subtle overflow-hidden">
          <button
            onClick={onZoomIn}
            disabled={zoomDisabled}
            aria-label="Acercar"
            title="Acercar"
            className="w-11 h-11 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-6 h-px bg-border-subtle" />
          <button
            onClick={onZoomOut}
            disabled={zoomDisabled}
            aria-label="Alejar"
            title="Alejar"
            className="w-11 h-11 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Fullscreen toggle (Google Maps-style) */}
      {onFullscreenToggle && (
        <button
          onClick={onFullscreenToggle}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          className="w-11 h-11 rounded-full bg-white shadow-level-2 border border-border-subtle text-slate-600 hover:text-navy hover:bg-slate-50 flex items-center justify-center active:scale-90 transition-all"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}