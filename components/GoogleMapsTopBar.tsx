'use client';

import React from 'react';
import {
  Search,
  Menu,
  X,
  Navigation,
  MapPin,
  ChevronDown,
  Lock,
  SlidersHorizontal,
  RotateCcw
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

const CATEGORY_EMOJI: Record<string, string> = {
  comida: '🍽️',
  tiendas: '🛍️',
  farmacias: '💊',
  cafeterias: '☕',
  servicios: '📱',
  ferreteria: '🔧',
  ropa: '👕'
};

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
  const chipBase =
    'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap border transition-all active:scale-95 flex-shrink-0 min-h-[44px]';
  const chipIdle =
    'bg-white border-border-subtle text-slate-600 hover:bg-slate-50 hover:border-border-strong shadow-level-1';
  const chipActive =
    'bg-navy border-navy text-white shadow-level-2';

  return (
    <div className="absolute top-3 left-3 right-3 md:left-6 md:right-auto z-30 pointer-events-auto flex flex-col gap-2.5 max-w-full">
      {/* Row 1: Navbar navy + búsqueda integrada (desktop) */}
      <div className="flex items-center gap-2">
        {/* Navbar brand (desktop) */}
        <div className="hidden md:flex items-center gap-2.5 h-12 px-4 bg-navy text-white rounded-lg shadow-level-2 select-none">
          <button
            onClick={onMenuClick}
            aria-label="Menú principal TransferCuba"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-navy-hover active:scale-95 transition-all"
            title="Menú y provincias"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 border-l border-white/15 pl-3">
            <span className="text-sm font-extrabold tracking-tight">
              Transfer<span className="text-cerulean-light">Cuba</span>
            </span>
          </div>
        </div>

        {/* Hamburger (mobile, fuera del navbar) */}
        <button
          onClick={onMenuClick}
          aria-label="Menú principal TransferCuba"
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg bg-white border border-border-subtle text-slate-700 shadow-level-1 active:scale-95 transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search sticky bar */}
        <div className="flex-1 md:max-w-[480px] h-11 md:h-12 flex items-center bg-white rounded-lg border border-border-subtle shadow-level-3 px-3 gap-2 transition-all focus-within:border-cerulean focus-within:ring-2 focus-within:ring-cerulean/25">
          <Search className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar negocios, direcciones…"
            className="flex-1 min-w-0 text-sm bg-transparent text-text-primary font-medium placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              aria-label="Borrar búsqueda"
              className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 border-l border-border-subtle pl-2 flex-shrink-0">
            <button
              onClick={onNearMeClick}
              aria-label="Buscar cerca de mí"
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                hasUserLocation
                  ? 'text-cerulean bg-tm-bg'
                  : 'text-slate-500 hover:text-cerulean hover:bg-slate-100'
              }`}
              title={hasUserLocation ? 'Ubicación activa' : 'Cerca de mí'}
            >
              <Navigation
                className={`w-4 h-4 ${isLocating ? 'animate-spin text-cerulean' : ''}`}
              />
            </button>
            <button
              onClick={onToggleFiltersModal}
              aria-label="Filtros avanzados"
              className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                hasActiveFilters
                  ? 'text-cerulean bg-tm-bg'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Filtros avanzados"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-cerulean absolute top-1.5 right-1.5 ring-2 ring-white" />
              )}
            </button>
          </div>
        </div>

        {/* Province selector pill (desktop) */}
        <button
          onClick={onProvinceClick}
          className="hidden lg:inline-flex items-center gap-1.5 h-12 px-4 rounded-lg bg-white border border-border-subtle shadow-level-1 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
        >
          <MapPin className="w-4 h-4 text-cerulean" />
          <span className="max-w-[140px] truncate">
            {selectedProvince === 'all' ? 'Toda Cuba' : selectedProvince}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Row 2: Chips — fila única, orden lógico, sin saturar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none max-w-[calc(100vw-24px)] md:max-w-[calc(100vw-48px)] touch-pan-x scroll-smooth">
        {/* Chip clave: Activo AHORA (verde = transferencia viva) */}
        <button
          onClick={onToggleOnlyActiveNow}
          className={`${chipBase} ${
            onlyActiveNow
              ? 'bg-emerald-brand border-emerald-brand text-white shadow-level-2'
              : `${chipIdle} text-emerald-brand`
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              onlyActiveNow ? 'bg-white animate-pulse' : 'bg-emerald-brand animate-beacon'
            }`}
          />
          <span>Activo ahora</span>
        </button>

        {/* Categorías (una sola fila, emoji + nombre corto) */}
        {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(isSelected ? 'all' : cat.id)}
              className={`${chipBase} ${isSelected ? chipActive : chipIdle}`}
            >
              <span>{CATEGORY_EMOJI[cat.id] ?? '🏪'}</span>
              <span>{cat.label.split('&')[0].trim()}</span>
            </button>
          );
        })}

        {/* Provincia (mobile) */}
        <button
          onClick={onProvinceClick}
          className={`${chipBase} ${chipIdle} md:hidden`}
        >
          <MapPin className="w-3.5 h-3.5 text-cerulean" />
          <span className="max-w-[110px] truncate">
            {selectedProvince === 'all' ? 'Toda Cuba' : selectedProvince}
          </span>
        </button>

        {/* Verificación como chip único cíclico (menos ruido visual) */}
        {(['verified', 'pending', 'reported'] as const).map((v) => {
          const isActive = filterVerification === v;
          const label = v === 'verified' ? 'Verificados' : v === 'pending' ? 'Pendientes' : 'Reportados';
          const dot =
            v === 'verified'
              ? 'bg-emerald-brand'
              : v === 'pending'
                ? 'bg-saffron'
                : 'bg-crimson';
          return (
            <button
              key={v}
              onClick={() =>
                onFilterVerificationChange(isActive ? 'all' : v)
              }
              className={`${chipBase} ${isActive ? chipActive : chipIdle}`}
            >
              <span className={`w-2 h-2 rounded-full ${dot} ${isActive ? '' : ''}`} />
              <span>{label}</span>
            </button>
          );
        })}

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-[13px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent whitespace-nowrap active:scale-95 transition-all flex-shrink-0"
            title="Restablecer filtros"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        )}

        {/* Admin discreto al final */}
        {onAdminClick && (
          <button
            onClick={onAdminClick}
            className={`${chipBase} ${chipIdle} text-slate-400`}
            title="Panel de Administración"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        )}
      </div>
    </div>
  );
}
