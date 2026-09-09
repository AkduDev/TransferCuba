'use client';

import React from 'react';
import { 
  MapPin, 
  PlusCircle, 
  ShieldCheck, 
  Sparkles, 
  Navigation, 
  Check, 
  Menu, 
  X,
  CreditCard,
  Building2,
  Compass,
  Radio
} from 'lucide-react';
import { CUBAN_PROVINCES } from '@/lib/cuba-data';

interface HeaderProps {
  onNearMeClick: () => void;
  onRegisterClick: () => void;
  onAdminClick: () => void;
  selectedProvince: string;
  onProvinceChange: (province: string) => void;
  isLocating: boolean;
  hasUserLocation: boolean;
}

export default function Header({
  onNearMeClick,
  onRegisterClick,
  onAdminClick,
  selectedProvince,
  onProvinceChange,
  isLocating,
  hasUserLocation
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="relative z-30 bg-slate-950 text-white border-b border-slate-800/80 shadow-xl">
      {/* Top Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Product Title */}
        <div className="flex items-center gap-3.5">
          {/* DevParadise Sleek Monogram Badge */}
          <div className="relative group flex-shrink-0 cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 p-[1.5px] shadow-lg shadow-emerald-900/30">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-tr from-emerald-300 via-teal-200 to-white text-base tracking-tight font-display">
                  DP
                </span>
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5 font-display">
                <span>¿Dónde Pago?</span>
                <span className="text-emerald-400 font-black">Cuba</span>
              </h1>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                En vivo
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium tracking-normal hidden sm:flex items-center gap-1">
              <span>Por</span>
              <strong className="text-slate-200 font-semibold tracking-wide">DevParadise</strong>
              <span className="text-slate-600">·</span>
              <span>Comercios con Transfermóvil y EnZona</span>
            </p>
          </div>
        </div>

        {/* Center / Action buttons on Desktop */}
        <div className="hidden lg:flex items-center gap-2.5">
          {/* Gran Diferencial: "Negocios cerca de mí" Button */}
          <button
            onClick={onNearMeClick}
            id="btn-header-near-me"
            className={`group relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md overflow-hidden ${
              hasUserLocation
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 ring-2 ring-blue-400/50'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-[0.98]'
            }`}
          >
            <Navigation className={`w-4 h-4 transition-transform group-hover:scale-110 ${isLocating ? 'animate-spin' : ''}`} />
            <span>
              {isLocating 
                ? 'Obteniendo GPS...' 
                : hasUserLocation 
                ? '📍 Cerca de mí (Activo)' 
                : '📍 Negocios cerca de mí'}
            </span>
          </button>

          {/* Business Registration Button */}
          <button
            onClick={onRegisterClick}
            id="btn-header-register-biz"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-emerald-500/50 transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>+ Registrar mi negocio</span>
          </button>

          {/* DevParadise Administration Center */}
          <button
            onClick={onAdminClick}
            id="btn-header-admin"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
            title="Panel de administración DevParadise"
          >
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span className="hidden xl:inline">Panel</span>
            <span>Admin</span>
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={onNearMeClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Cerca de mí</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden px-4 py-3 bg-slate-950 border-t border-slate-800/80 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300">
            <p className="font-semibold text-white mb-0.5">Directorio Digital de Pagos en Cuba</p>
            <p className="text-[11px] text-slate-400">
              Encuentra qué negocios aceptan Transfermóvil, EnZona y código QR en tiempo real.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                onRegisterClick();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Registrar mi negocio gratis</span>
            </button>

            <button
              onClick={() => {
                onAdminClick();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white font-medium text-xs border border-slate-800"
            >
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>DevParadise Admin & Moderación</span>
            </button>
          </div>
        </div>
      )}

      {/* Province Ribbon Bar (Smooth, horizontal pills across Cuba) */}
      <div className="bg-slate-950/95 border-t border-slate-800/60 py-1.5 px-4 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-semibold whitespace-nowrap text-[11px] flex items-center gap-1 mr-1 select-none">
            <span>🇨🇺</span>
            <span className="hidden sm:inline text-slate-400">Provincia:</span>
          </span>

          <button
            onClick={() => onProvinceChange('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedProvince === 'all'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400/40'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            Toda Cuba
          </button>

          {CUBAN_PROVINCES.map((prov) => (
            <button
              key={prov.name}
              onClick={() => onProvinceChange(prov.name)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedProvince === prov.name
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40 ring-1 ring-blue-400/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {prov.name}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
