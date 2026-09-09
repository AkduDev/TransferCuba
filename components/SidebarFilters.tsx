'use client';

import React from 'react';
import { 
  Search, 
  MapPin, 
  Filter, 
  CreditCard, 
  Check, 
  Navigation, 
  ShieldCheck, 
  X,
  ChevronDown,
  Sparkles,
  Store,
  ChevronRight,
  SlidersHorizontal,
  Power,
  RotateCcw,
  Zap,
  QrCode,
  Globe
} from 'lucide-react';
import { Business, CUBAN_PROVINCES, CATEGORIES, formatDistance } from '@/lib/cuba-data';

interface SidebarFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedProvince: string;
  onProvinceChange: (province: string) => void;
  selectedMunicipality: string;
  onMunicipalityChange: (municipality: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  
  // Payment filters
  onlyTransfer: boolean;
  onToggleOnlyTransfer: () => void;
  filterQr: boolean;
  onToggleFilterQr: () => void;
  filterOnline: boolean;
  onToggleFilterOnline: () => void;
  
  // Feature 14: ¿Acepta transferencia AHORA?
  onlyActiveNow: boolean;
  onToggleOnlyActiveNow: () => void;

  // Near me state
  hasUserLocation: boolean;
  userLocationName: string;
  onNearMeClick: () => void;
  onClearLocation: () => void;

  // Businesses result list
  filteredBusinesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (b: Business) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export default function SidebarFilters({
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
  filterQr,
  onToggleFilterQr,
  filterOnline,
  onToggleFilterOnline,
  onlyActiveNow,
  onToggleOnlyActiveNow,
  hasUserLocation,
  userLocationName,
  onNearMeClick,
  onClearLocation,
  filteredBusinesses,
  selectedBusiness,
  onSelectBusiness,
  isOpenMobile,
  onCloseMobile
}: SidebarFiltersProps) {
  const currentProvinceData = CUBAN_PROVINCES.find(p => p.name === selectedProvince);
  const municipalities = currentProvinceData ? currentProvinceData.municipalities : [];

  const hasAnyFilterActive = 
    selectedProvince !== 'all' || 
    selectedMunicipality !== 'all' || 
    selectedCategory !== 'all' || 
    onlyTransfer || 
    filterQr || 
    filterOnline || 
    onlyActiveNow || 
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    onProvinceChange('all');
    onMunicipalityChange('all');
    onCategoryChange('all');
    if (onlyTransfer) onToggleOnlyTransfer();
    if (filterQr) onToggleFilterQr();
    if (filterOnline) onToggleFilterOnline();
    if (onlyActiveNow) onToggleOnlyActiveNow();
    onSearchChange('');
  };

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 z-30 w-full sm:w-96 lg:w-[410px] bg-slate-50 border-r border-slate-200/90 shadow-2xl lg:shadow-none flex flex-col transition-transform duration-300 ${
        isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Search Header Area */}
      <div className="p-4 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3 lg:hidden">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            <span className="font-display">Filtros y Búsqueda</span>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            id="input-search-biz"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, producto o calle..."
            className="w-full text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-md"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* GPS Near Me Shortcut inside sidebar */}
        <div className="mt-3">
          {!hasUserLocation ? (
            <button
              onClick={onNearMeClick}
              id="btn-sidebar-near-me"
              className="w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Navigation className="w-4 h-4 text-emerald-100" />
              <span>📍 Negocios cerca de mí (GPS)</span>
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-center justify-between text-xs text-blue-950">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0" />
                <span className="truncate text-slate-700">
                  Cerca de: <strong className="text-blue-900 font-bold">{userLocationName}</strong>
                </span>
              </div>
              <button
                onClick={onClearLocation}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold hover:underline ml-2 flex-shrink-0"
              >
                Quitar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Options (Scrollable area) */}
      <div className="p-4 border-b border-slate-200/80 space-y-4 bg-white overflow-y-auto max-h-64 sm:max-h-72 flex-shrink-0">
        {/* Province & Municipality */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zona geográfica</span>
            </span>
            {hasAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer todo</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Provincia
              </label>
              <select
                id="select-province"
                value={selectedProvince}
                onChange={(e) => onProvinceChange(e.target.value)}
                className="w-full text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              >
                <option value="all">🇨🇺 Toda Cuba</option>
                {CUBAN_PROVINCES.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Municipio
              </label>
              <select
                id="select-municipality"
                disabled={selectedProvince === 'all'}
                value={selectedMunicipality}
                onChange={(e) => onMunicipalityChange(e.target.value)}
                className="w-full text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="all">Todos los municipios</option>
                {municipalities.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Categoría
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-950 text-white shadow-sm ring-1 ring-slate-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuban Live Status Switch & Payment Filter */}
        <div className="space-y-2.5 pt-1">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Disponibilidad de transferencia en Cuba
          </label>

          {/* Toggle: Acepta Transferencia AHORA (Special Cuban feature) */}
          <div
            onClick={onToggleOnlyActiveNow}
            role="button"
            tabIndex={0}
            className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
              onlyActiveNow 
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-sm shadow-emerald-500/10' 
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <span className={`w-3 h-3 rounded-full ${onlyActiveNow ? 'bg-emerald-500 animate-beacon' : 'bg-slate-400'}`} />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">
                  {onlyActiveNow ? '🟢 Transferencia activa AHORA' : 'Solo con transferencia activa hoy'}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  Filtra comercios que confirmaron señal y sistema hoy
                </p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors ${
              onlyActiveNow ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
            }`}>
              {onlyActiveNow && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>

          {/* Payment Method Pills */}
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              onClick={onToggleOnlyTransfer}
              className={`p-2 rounded-xl border font-semibold flex flex-col items-center justify-center text-center gap-1 transition-all ${
                onlyTransfer 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] leading-tight">Transfermóvil / EnZona</span>
            </button>

            <button
              onClick={onToggleFilterQr}
              className={`p-2 rounded-xl border font-semibold flex flex-col items-center justify-center text-center gap-1 transition-all ${
                filterQr 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[10px] leading-tight">Código QR</span>
            </button>

            <button
              onClick={onToggleFilterOnline}
              className={`p-2 rounded-xl border font-semibold flex flex-col items-center justify-center text-center gap-1 transition-all ${
                filterOnline 
                  ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-sm' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[10px] leading-tight">En línea</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Header Bar */}
      <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200/80 flex items-center justify-between text-xs">
        <span className="font-extrabold text-slate-900 font-display">
          {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'negocio encontrado' : 'negocios encontrados'}
        </span>
        {hasUserLocation && (
          <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span>📍</span> Ordenados por cercanía
          </span>
        )}
      </div>

      {/* Results List Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredBusinesses.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-200/60 flex items-center justify-center mx-auto text-slate-400">
              <Store className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-700 font-display">No hay resultados con estos filtros</p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
              Prueba cambiando la provincia, borrando el texto de búsqueda o activando más opciones de pago.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Restablecer filtros
            </button>
          </div>
        ) : (
          filteredBusinesses.map((biz) => {
            const isSelected = selectedBusiness?.id === biz.id;
            return (
              <div
                key={biz.id}
                onClick={() => onSelectBusiness(biz)}
                id={`biz-item-${biz.id}`}
                className={`group p-3.5 rounded-2xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-400 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400'
                    : 'bg-white hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs">{biz.categoryIcon}</span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate font-display group-hover:text-emerald-700 transition-colors">
                        {biz.name}
                      </h3>
                      {biz.transferVerified && (
                        <span title="DevParadise Verificado" className="inline-flex items-center">
                          <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span>{biz.neighborhood ? `${biz.neighborhood}, ` : ''}{biz.municipality}</span>
                    </p>
                  </div>

                  {/* Distance badge if location is active */}
                  {biz.distanceMeters !== undefined && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold flex-shrink-0 whitespace-nowrap">
                      {formatDistance(biz.distanceMeters)}
                    </span>
                  )}
                </div>

                {/* Transfer channels badges */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                  {biz.transferDetails?.transfermovil && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-bold">
                      Transfermóvil
                    </span>
                  )}
                  {biz.transferDetails?.enzona && (
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/60 font-bold">
                      EnZona
                    </span>
                  )}
                  {biz.transferDetails?.qrPayment && (
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200/60 font-bold">
                      Código QR
                    </span>
                  )}
                </div>

                {/* Real-time Status footer */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px]">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    biz.transferActiveNow 
                      ? 'bg-emerald-100/90 text-emerald-800' 
                      : 'bg-amber-100/90 text-amber-800'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${biz.transferActiveNow ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                    {biz.transferActiveNow ? 'Transferencia activa' : 'Sin transfer hoy'}
                  </span>

                  <span className="text-[10px] text-slate-400 font-medium">
                    {biz.lastStatusUpdate}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
