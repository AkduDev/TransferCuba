'use client';

import React, { useState } from 'react';
import { 
  MapPin, 
  MessageCircle, 
  Navigation, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  Layers, 
  List, 
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Business } from '@/lib/cuba-data';

interface TransferCubaMobileViewProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (b: Business) => void;
  onCalculateRoute: (b: Business) => void;
  hasUserLocation: boolean;
  onNearMeClick: () => void;
  mapComponent: React.ReactNode;
}

export default function TransferCubaMobileView({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  onCalculateRoute,
  hasUserLocation,
  onNearMeClick,
  mapComponent
}: TransferCubaMobileViewProps) {
  // Mobile layout mode: 'split' (map 50% + list 50%), 'map-heavy' (map 85%), 'list-heavy' (list 85%)
  const [viewMode, setViewMode] = useState<'split' | 'map-heavy' | 'list-heavy'>('split');

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100">
      {/* Upper Area: Interactive MAPA */}
      <div 
        className={`relative w-full transition-all duration-300 ease-in-out ${
          viewMode === 'map-heavy' 
            ? 'h-[82%]' 
            : viewMode === 'list-heavy' 
            ? 'h-[25%]' 
            : 'h-[50%]'
        }`}
      >
        {mapComponent}

        {/* Floating View Mode Switcher on Map */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setViewMode(viewMode === 'map-heavy' ? 'split' : 'map-heavy')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'map-heavy' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Ampliar mapa"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'split' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Vista dividida"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'list-heavy' ? 'split' : 'list-heavy')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list-heavy' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Ampliar lista de negocios"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Area: "X negocios cerca" matching the ASCII Wireframe */}
      <div 
        className={`w-full bg-white flex flex-col border-t border-slate-200 shadow-2xl rounded-t-2xl z-20 transition-all duration-300 ease-in-out ${
          viewMode === 'map-heavy' 
            ? 'h-[18%]' 
            : viewMode === 'list-heavy' 
            ? 'h-[75%]' 
            : 'h-[50%]'
        }`}
      >
        {/* Header bar of bottom section */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">
              {businesses.length} {businesses.length === 1 ? 'negocio cerca' : 'negocios cerca'}
            </h3>
          </div>
          {!hasUserLocation && (
            <button
              onClick={onNearMeClick}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Navigation className="w-3 h-3" />
              <span>Usar mi GPS</span>
            </button>
          )}
        </div>

        {/* Scrollable list of business cards */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
          {businesses.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <p className="text-xs font-bold text-slate-700">No hay negocios en esta vista</p>
              <p className="text-[11px] text-slate-400 mt-1">Prueba ampliando la búsqueda o el mapa.</p>
            </div>
          ) : (
            businesses.map((biz) => {
              const isSelected = selectedBusiness?.id === biz.id;
              const isReported = biz.reportsCount > 0;
              const isVerified = biz.transferVerified && !isReported;
              const isPending = !isVerified && !isReported;

              return (
                <div
                  key={biz.id}
                  onClick={() => onSelectBusiness(biz)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-400 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl mt-0.5">{biz.categoryIcon}</span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                          {biz.name}
                        </h4>
                        
                        {/* ✓ Transferencia badge */}
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-700">
                          <span className="text-emerald-600 font-black">✓</span>
                          <span>Transferencia</span>
                          {biz.transferActiveNow ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                              🟢 Activa
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                              🟡 Efectivo
                            </span>
                          )}
                        </div>

                        {/* 📍 450 m · Playa matching ASCII wireframe */}
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-slate-700">
                            {biz.distanceMeters !== undefined 
                              ? biz.distanceMeters < 1000 
                                ? `${biz.distanceMeters} m` 
                                : `${(biz.distanceMeters / 1000).toFixed(1)} km`
                              : biz.municipality}
                          </span>
                          <span>·</span>
                          <span>{biz.municipality}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right side CTAs */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {isVerified && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                          ✓ Verificado
                        </span>
                      )}
                      {isPending && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                          ⏳ Pendiente
                        </span>
                      )}
                      {isReported && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                          ⚠ Reportado
                        </span>
                      )}

                      <div className="flex items-center gap-1 mt-1">
                        {biz.whatsapp && (
                          <a
                            href={`https://wa.me/${biz.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, vi ${biz.name} en TransferCuba y quisiera comprar por transferencia.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCalculateRoute(biz);
                          }}
                          className="px-2 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg shadow-sm flex items-center gap-1"
                          title="Ruta OSRM"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Ruta</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
