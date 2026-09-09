'use client';

import React from 'react';
import { 
  X, 
  Navigation, 
  MapPin, 
  Compass, 
  Sparkles,
  Check,
  Building,
  ChevronRight
} from 'lucide-react';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCoordinates: (coords: { lat: number; lng: number }, name: string) => void;
  onUseCurrentGps: () => void;
  isLocating: boolean;
}

export const CUBAN_GPS_PRESETS = [
  {
    name: 'Vedado, La Habana (Calle 23 y L)',
    sub: 'Cerca del Cine Yara y Hotel Habana Libre',
    coords: { lat: 23.1385, lng: -82.3842 }
  },
  {
    name: 'Centro Habana (Galiano y San Rafael)',
    sub: 'Bulevar comercial y tiendas céntricas',
    coords: { lat: 23.1370, lng: -82.3620 }
  },
  {
    name: 'Habana Vieja (Parque Central / Prado)',
    sub: 'Casco histórico y hoteles principales',
    coords: { lat: 23.1372, lng: -82.3585 }
  },
  {
    name: 'Miramar, Playa (3ra y 42)',
    sub: 'Zona residencial, embajadas y comercios',
    coords: { lat: 23.1230, lng: -82.4210 }
  },
  {
    name: 'Holguín Centro (Parque Calixto García)',
    sub: 'Zona céntrica oriental de comercios y servicios',
    coords: { lat: 20.8875, lng: -76.2630 }
  },
  {
    name: 'Santiago de Cuba (Parque Céspedes)',
    sub: 'Corazón de Santiago y calle Enramadas',
    coords: { lat: 20.0210, lng: -75.8275 }
  }
];

export default function LocationPickerModal({
  isOpen,
  onClose,
  onSelectCoordinates,
  onUseCurrentGps,
  isLocating
}: LocationPickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold font-display text-white">Negocios Cerca de Mí</h2>
              <p className="text-xs text-slate-400">Calcula la distancia a comercios con transferencia activa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Real GPS Option */}
          <button
            onClick={onUseCurrentGps}
            disabled={isLocating}
            id="btn-use-real-gps"
            className="w-full p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          >
            <Compass className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Detectando señal GPS del dispositivo...' : '📍 Usar mi ubicación GPS actual'}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-display">
              o seleccionar punto de referencia
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Quick presets in Cuba */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {CUBAN_GPS_PRESETS.map((preset, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelectCoordinates(preset.coords, preset.name);
                  onClose();
                }}
                className="p-3.5 rounded-2xl border border-slate-200/90 hover:border-emerald-500 hover:bg-emerald-50/60 cursor-pointer transition-all flex items-center justify-between group shadow-sm hover:shadow-md"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-100/80 text-slate-500 group-hover:text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-950 font-display">
                      {preset.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {preset.sub}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
