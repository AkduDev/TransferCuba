'use client';

import React from 'react';
import { 
  Search, 
  MapPin, 
  PlusCircle, 
  User, 
  Menu, 
  Navigation,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface TransferCubaHeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onNearMeClick: () => void;
  onRegisterClick: () => void;
  onAdminClick: () => void;
  onMenuToggle: () => void;
  hasUserLocation: boolean;
  isLocating: boolean;
  totalBusinesses: number;
}

export default function TransferCubaHeader({
  searchQuery,
  onSearchChange,
  onNearMeClick,
  onRegisterClick,
  onAdminClick,
  onMenuToggle,
  hasUserLocation,
  isLocating,
  totalBusinesses
}: TransferCubaHeaderProps) {
  return (
    <header className="relative z-30 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Abrir menú"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSearchChange('')}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <span className="font-black text-sm tracking-tighter">TC</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
                  TransferCuba
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  OSM
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                El mapa de los negocios con transferencia
              </p>
            </div>
          </div>
        </div>

        {/* Center: Search input (Visible on desktop & tablets) */}
        <div className="hidden md:flex flex-1 max-w-md mx-2">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar tiendas, comida, farmacias..."
              className="w-full bg-slate-800/90 text-white text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-400 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions (GPS, Registrar, Entrar / Admin) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Near Me GPS */}
          <button
            onClick={onNearMeClick}
            disabled={isLocating}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              hasUserLocation
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 ring-2 ring-blue-400/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Detectar mi ubicación en Cuba"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-emerald-400' : 'text-blue-400'}`} />
            <span className="hidden sm:inline">
              {isLocating ? 'Buscando...' : hasUserLocation ? 'Cerca de mí' : 'Mi GPS'}
            </span>
          </button>

          {/* + Registrar Negocio */}
          <button
            onClick={onRegisterClick}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/40 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Registrar negocio</span>
            <span className="sm:hidden">Sumar</span>
          </button>

          {/* Admin / Login */}
          <button
            onClick={onAdminClick}
            className="p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Panel de verificación DevParadise"
          >
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Entrar</span>
          </button>
        </div>
      </div>

      {/* Mobile Search Bar Row (When on small screens) */}
      <div className="md:hidden px-3 pb-2.5 pt-1">
        <div className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="🔍 ¿Qué buscas? (ej. pizza, farmacia, MLC, CUP)"
            className="w-full bg-slate-800 text-white text-xs pl-8 pr-7 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
