'use client';

import React from 'react';
import { 
  Search, 
  Menu, 
  X, 
  Navigation, 
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  MapPin,
  Check,
  Lock
} from 'lucide-react';
import { CATEGORIES } from '@/lib/cuba-data';

interface GoogleMapsTopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onMenuClick: () => void;
  onNearMeClick: () => void;
  hasUserLocation: boolean;
  isLocating: boolean;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  onlyActiveNow: boolean;
  onToggleOnlyActiveNow: () => void;
  onlyTransfer: boolean;
  onToggleOnlyTransfer: () => void;
  filterVerification: string;
  onFilterVerificationChange: (v: string) => void;
  selectedProvince: string;
  onProvinceClick: () => void;
  onToggleFiltersModal: () => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onAdminClick?: () => void;
}

export default function GoogleMapsTopBar({
  searchQuery,
  onSearchChange,
  onMenuClick,
  onNearMeClick,
  hasUserLocation,
  isLocating,
  selectedCategory,
  onCategoryChange,
  onlyActiveNow,
  onToggleOnlyActiveNow,
  onlyTransfer,
  onToggleOnlyTransfer,
  filterVerification,
  onFilterVerificationChange,
  selectedProvince,
  onProvinceClick,
  onToggleFiltersModal,
  hasActiveFilters,
  onResetFilters,
  onAdminClick
}: GoogleMapsTopBarProps) {
  return (
    <div 
      id="google-maps-top-bar"
      className="absolute top-[max(0.625rem,env(safe-area-inset-top,0.625rem))] left-2.5 right-2.5 md:right-auto md:left-4 z-30 pointer-events-auto flex flex-col gap-1.5 sm:gap-2 max-w-[calc(100vw-20px)]"
    >
      {/* Google Maps Floating Search Capsule */}
      <div className="h-11 sm:h-12 w-full md:w-[390px] xl:w-[410px] flex items-center justify-between bg-white rounded-2xl shadow-xl shadow-slate-900/15 border border-slate-200/90 px-2 sm:px-3 transition-all focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500">
        {/* Hamburger Menu button - Centered with flexbox */}
        <button
          onClick={onMenuClick}
          id="btn-gm-menu"
          aria-label="Menú principal TransferCuba"
          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all flex-shrink-0"
          title="Menú y provincias"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        {/* TransferCuba Mini Logo - Compact on larger screens, hidden on mobile for 1-line search space */}
        <div className="hidden sm:flex items-center gap-1 pl-1.5 pr-2.5 border-r border-slate-200/80 mr-1.5 select-none flex-shrink-0">
          <span className="text-sm">🇨🇺</span>
          <span className="text-xs font-black text-slate-900 font-display tracking-tight">
            Transfer<span className="text-emerald-600">Cuba</span>
          </span>
        </div>

        {/* Search Input - Expands fully in a single line on mobile */}
        <div className="relative flex-1 flex items-center min-w-0 mx-1.5 sm:mx-2">
          <Search className="w-4 h-4 text-slate-400 mr-1.5 flex-shrink-0 sm:hidden" />
          <input
            type="text"
            id="input-gm-search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar negocios, servicios..."
            className="w-full text-xs sm:text-sm bg-transparent text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none truncate"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mr-0.5 flex-shrink-0"
              aria-label="Borrar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action icons inside the search capsule - Centered with flexbox when < 640px */}
        <div className="flex items-center justify-center gap-0.5 sm:gap-1 border-l border-slate-200/90 pl-1 sm:pl-1.5 flex-shrink-0">
          {/* GPS Near Me button - Centered with flexbox */}
          <button
            onClick={onNearMeClick}
            id="btn-gm-near-me"
            className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all ${
              hasUserLocation 
                ? 'text-blue-600 bg-blue-50 font-bold' 
                : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-100'
            }`}
            title={hasUserLocation ? 'Ubicación activa (GPS)' : 'Buscar cerca de mí'}
          >
            <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* Advanced filters button - Centered with flexbox */}
          <button
            onClick={onToggleFiltersModal}
            id="btn-gm-filters"
            className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all relative ${
              hasActiveFilters 
                ? 'text-emerald-700 bg-emerald-50 font-bold' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Filtros avanzados"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-emerald-600 absolute top-1.5 right-1.5 ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>

      {/* Google Maps Horizontal Category Chips Bar with smooth touch scrolling */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none w-full max-w-[calc(100vw-20px)] md:max-w-[calc(100vw-40px)] touch-pan-x scroll-smooth">
        {/* Province Quick Pill */}
        <button
          onClick={onProvinceClick}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white/95 hover:bg-white text-slate-800 shadow-md shadow-slate-900/10 border border-slate-200/90 whitespace-nowrap active:scale-95 transition-all flex-shrink-0"
        >
          <span>📍</span>
          <span className="truncate max-w-[110px]">{selectedProvince === 'all' ? 'Toda Cuba' : selectedProvince}</span>
        </button>

        {/* Live Transfer Status Chip */}
        <button
          onClick={onToggleOnlyActiveNow}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md shadow-slate-900/10 border active:scale-95 transition-all flex-shrink-0 ${
            onlyActiveNow
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20'
              : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/90'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${onlyActiveNow ? 'bg-white animate-pulse' : 'bg-emerald-500 animate-beacon'}`} />
          <span>Activo AHORA</span>
        </button>

        {/* Verification Status Chips */}
        <button
          onClick={() => onFilterVerificationChange(filterVerification === 'verified' ? 'all' : 'verified')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md shadow-slate-900/10 border active:scale-95 transition-all flex-shrink-0 ${
            filterVerification === 'verified'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/90'
          }`}
        >
          <span>🟢</span>
          <span>Verificados</span>
        </button>

        <button
          onClick={() => onFilterVerificationChange(filterVerification === 'pending' ? 'all' : 'pending')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md shadow-slate-900/10 border active:scale-95 transition-all flex-shrink-0 ${
            filterVerification === 'pending'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/90'
          }`}
        >
          <span>🟡</span>
          <span>Pendientes</span>
        </button>

        <button
          onClick={() => onFilterVerificationChange(filterVerification === 'reported' ? 'all' : 'reported')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md shadow-slate-900/10 border active:scale-95 transition-all flex-shrink-0 ${
            filterVerification === 'reported'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/90'
          }`}
        >
          <span>🔴</span>
          <span>Reportados</span>
        </button>

        {/* Categories Chips */}
        {CATEGORIES.filter(c => c.id !== 'all').map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(isSelected ? 'all' : cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md shadow-slate-900/10 border active:scale-95 transition-all flex-shrink-0 ${
                isSelected
                  ? 'bg-slate-950 text-white border-slate-950'
                  : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/90'
              }`}
            >
              <span>{cat.icon === 'Utensils' ? '🍕' : cat.icon === 'ShoppingBag' ? '🛒' : cat.icon === 'Pill' ? '💊' : cat.icon === 'Coffee' ? '☕' : cat.icon === 'Smartphone' ? '📱' : cat.icon === 'Wrench' ? '🔧' : '👕'}</span>
              <span>{cat.label.split('&')[0].trim()}</span>
            </button>
          );
        })}

        {/* Admin shortcut chip */}
        {onAdminClick && (
          <button
            onClick={onAdminClick}
            id="chip-admin-login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/15 border border-slate-700 whitespace-nowrap active:scale-95 transition-all flex-shrink-0"
            title="Panel de Administración (Requiere clave)"
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Admin</span>
          </button>
        )}

        {/* Reset chip if filters active */}
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm border border-slate-200 whitespace-nowrap flex-shrink-0"
            title="Restablecer filtros"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpiar</span>
          </button>
        )}
      </div>
    </div>
  );
}
