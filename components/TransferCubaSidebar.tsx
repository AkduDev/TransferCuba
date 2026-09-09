'use client';

import React from 'react';
import { 
  Search, 
  MapPin, 
  Check, 
  Filter, 
  Navigation, 
  ShieldCheck, 
  Clock, 
  MessageCircle, 
  Compass, 
  RotateCcw,
  Sparkles,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { Business, CUBAN_PROVINCES, CATEGORIES } from '@/lib/cuba-data';

interface TransferCubaSidebarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedProvince: string;
  onProvinceChange: (val: string) => void;
  selectedMunicipality: string;
  onMunicipalityChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (val: string) => void;
  onlyTransfer: boolean;
  onToggleOnlyTransfer: () => void;
  onlyActiveNow: boolean;
  onToggleOnlyActiveNow: () => void;
  filterVerification: string; // 'all' | 'verified' | 'pending' | 'reported'
  onFilterVerificationChange: (val: string) => void;
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (b: Business) => void;
  onCalculateRoute: (b: Business) => void;
  hasUserLocation: boolean;
  userLocationName: string;
  onNearMeClick: () => void;
  onResetFilters: () => void;
}

export default function TransferCubaSidebar({
  searchQuery,
  onSearchChange,
  selectedProvince,
  onProvinceChange,
  selectedMunicipality,
  onMunicipalityChange,
  selectedCategory,
  onCategoryChange,
  onlyTransfer,
  onToggleOnlyTransfer,
  onlyActiveNow,
  onToggleOnlyActiveNow,
  filterVerification,
  onFilterVerificationChange,
  businesses,
  selectedBusiness,
  onSelectBusiness,
  onCalculateRoute,
  hasUserLocation,
  userLocationName,
  onNearMeClick,
  onResetFilters
}: TransferCubaSidebarProps) {
  const currentProvinceData = CUBAN_PROVINCES.find((p) => p.name === selectedProvince);

  return (
    <aside className="w-full h-full flex flex-col bg-white border-r border-slate-200 overflow-hidden text-slate-800">
      {/* Top Filter Controls Section matching the ASCII Wireframe */}
      <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200 space-y-3 flex-shrink-0">
        {/* ¿Qué buscas? */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            ¿Qué buscas?
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="🔍 Tiendas, pizzerías, farmacias..."
              className="w-full bg-white text-xs sm:text-sm px-3 py-2 pl-8 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 placeholder-slate-400 shadow-sm"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 📍 Ubicación: Provincia & Municipio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ubicación</span>
            </label>
            {hasUserLocation && (
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                <span>📍 GPS Activo</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Provincia Selector */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Provincia</label>
              <select
                value={selectedProvince}
                onChange={(e) => onProvinceChange(e.target.value)}
                className="w-full bg-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-sm"
              >
                <option value="all">🇨🇺 Toda Cuba</option>
                {CUBAN_PROVINCES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Municipio Selector */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Municipio</label>
              <select
                value={selectedMunicipality}
                onChange={(e) => onMunicipalityChange(e.target.value)}
                disabled={selectedProvince === 'all'}
                className="w-full bg-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-sm disabled:opacity-50"
              >
                <option value="all">Todos los municipios</option>
                {currentProvinceData?.municipalities.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Categoría Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Categoría
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full bg-white text-xs sm:text-sm px-3 py-1.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-sm"
          >
            <option value="all">Todas las categorías</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* ☑ Acepta Transferencia Switch & Live Status */}
        <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="text-emerald-600 font-black">✓</span>
              <span>Acepta transferencia</span>
            </span>
            <input
              type="checkbox"
              checked={onlyTransfer}
              onChange={onToggleOnlyTransfer}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Disponible AHORA (en vivo)</span>
            </span>
            <input
              type="checkbox"
              checked={onlyActiveNow}
              onChange={onToggleOnlyActiveNow}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
          </label>
        </div>

        {/* Verification Status Filter Chips (🟢 Verificado, 🟡 Pendiente, 🔴 Reportado) */}
        <div className="pt-2 border-t border-slate-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Estado de verificación
            </span>
            {(searchQuery || selectedCategory !== 'all' || selectedProvince !== 'La Habana' || filterVerification !== 'all') && (
              <button
                onClick={onResetFilters}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Restablecer</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => onFilterVerificationChange('all')}
              className={`py-1 text-[10px] font-bold rounded-lg border transition-all ${
                filterVerification === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => onFilterVerificationChange('verified')}
              className={`py-1 text-[10px] font-bold rounded-lg border transition-all flex items-center justify-center gap-0.5 ${
                filterVerification === 'verified'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-emerald-700 border-slate-200 hover:bg-emerald-50'
              }`}
              title="✓ Transferencia verificada por DevParadise"
            >
              <span>🟢 Verificados</span>
            </button>
            <button
              onClick={() => onFilterVerificationChange('pending')}
              className={`py-1 text-[10px] font-bold rounded-lg border transition-all flex items-center justify-center gap-0.5 ${
                filterVerification === 'pending'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-white text-amber-700 border-slate-200 hover:bg-amber-50'
              }`}
              title="⏳ Pendiente de verificación"
            >
              <span>🟡 Pendiente</span>
            </button>
            <button
              onClick={() => onFilterVerificationChange('reported')}
              className={`py-1 text-[10px] font-bold rounded-lg border transition-all flex items-center justify-center gap-0.5 ${
                filterVerification === 'reported'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-white text-rose-700 border-slate-200 hover:bg-rose-50'
              }`}
              title="⚠️ Reportes de posibles fallos"
            >
              <span>🔴 Reportado</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Header: "24 negocios" */}
      <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600 flex-shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-900 font-extrabold">{businesses.length}</span>
          <span>{businesses.length === 1 ? 'negocio encontrado' : 'negocios encontrados'}</span>
        </span>
        {hasUserLocation && (
          <span className="text-[10px] text-blue-700 font-semibold flex items-center gap-1">
            <Compass className="w-3 h-3 text-blue-600" />
            <span>Ordenado por cercanía</span>
          </span>
        )}
      </div>

      {/* Scrollable Results List matching ASCII Wireframe */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {businesses.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-2xl">
              🔍
            </div>
            <p className="text-sm font-bold text-slate-800">No encontramos negocios con estos filtros</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Prueba cambiando la provincia, borrando el término de búsqueda o desactivando el filtro de transferencia en vivo.
            </p>
            <button
              onClick={onResetFilters}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
            >
              Mostrar todos en Cuba
            </button>
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
                className={`p-3.5 transition-all cursor-pointer hover:bg-slate-50 relative group ${
                  isSelected ? 'bg-emerald-50/70 border-l-4 border-emerald-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl flex-shrink-0">{biz.categoryIcon}</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                        {biz.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="font-semibold text-slate-700">
                          {biz.distanceMeters !== undefined 
                            ? biz.distanceMeters < 1000 
                              ? `${biz.distanceMeters} m` 
                              : `${(biz.distanceMeters / 1000).toFixed(1)} km`
                            : biz.municipality}
                        </span>
                        <span>·</span>
                        <span>{biz.municipality}, {biz.province}</span>
                      </p>
                    </div>
                  </div>

                  {/* Verification status badge */}
                  <div className="flex-shrink-0">
                    {isVerified && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Verificado</span>
                      </span>
                    )}
                    {isPending && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300/60 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Pendiente</span>
                      </span>
                    )}
                    {isReported && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300/60 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Reportado</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Transfer Info row matching: ✓ Transferencia */}
                <div className="mt-2 flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-bold text-emerald-700">
                      <span className="text-emerald-600 font-extrabold">✓</span>
                      <span>Transferencia</span>
                    </span>
                    {biz.transferActiveNow ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Activa hoy</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                        Solo efectivo hoy
                      </span>
                    )}
                  </div>

                  {/* Action CTA Buttons */}
                  <div className="flex items-center gap-1.5">
                    {biz.whatsapp && (
                      <a
                        href={`https://wa.me/${biz.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, vi ${biz.name} en TransferCuba y quisiera consultar disponibilidad y pago por transferencia.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Contactar por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCalculateRoute(biz);
                      }}
                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg border border-blue-200/70 flex items-center gap-1 transition-colors"
                      title="Calcular ruta OSRM"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Ruta</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
