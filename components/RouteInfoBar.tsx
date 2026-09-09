'use client';

import React from 'react';
import { Navigation, X, ExternalLink, Car, Footprints } from 'lucide-react';
import { Business } from '@/lib/cuba-data';
import { OSRMRouteResult } from '@/lib/osrm';

interface RouteInfoBarProps {
  route: OSRMRouteResult;
  business: Business;
  onClearRoute: () => void;
}

export default function RouteInfoBar({
  route,
  business,
  onClearRoute
}: RouteInfoBarProps) {
  const distanceKm = (route.distanceMeters / 1000).toFixed(1);
  const durationMin = Math.max(1, Math.round(route.durationSeconds / 60));
  const walkingMin = Math.round(durationMin * 3.5);

  const osmRouteUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${business.lat}%2C${business.lng}#map=15/${business.lat}/${business.lng}`;

  return (
    <div className="absolute top-[96px] sm:top-[104px] left-2.5 right-2.5 md:left-auto md:right-6 md:top-3 md:translate-x-0 z-30 w-auto max-w-[calc(100vw-20px)] sm:max-w-sm md:max-w-md bg-slate-900/95 text-white backdrop-blur-md px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg shadow-level-4 border border-slate-700/80 flex items-center justify-between gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2 pointer-events-auto">
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-brand text-white flex items-center justify-center shadow-level-2 flex-shrink-0">
          <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-slate-100 truncate">
              Ruta hacia <span className="text-emerald-400">{business.name}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-300 mt-0.5 font-medium flex-wrap">
            <span className="flex items-center gap-1 font-bold text-white">
              <Car className="w-3 h-3 text-emerald-400" />
              <span>{distanceKm} km · {durationMin} min</span>
            </span>
            <span className="text-slate-500 hidden xs:inline">|</span>
            <span className="flex items-center gap-1 text-slate-400 hidden xs:flex">
              <Footprints className="w-3 h-3 text-slate-400" />
              <span>~{walkingMin} min</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <a
          href={osmRouteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          title="Ver ruta en OpenStreetMap"
        >
          <span>OSM</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={onClearRoute}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Cerrar ruta"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
