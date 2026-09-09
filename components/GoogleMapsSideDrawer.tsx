'use client';

import React from 'react';
import { 
  X, 
  MapPin, 
  PlusCircle, 
  ShieldCheck, 
  Navigation, 
  CreditCard, 
  QrCode, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { CUBAN_PROVINCES } from '@/lib/cuba-data';

interface GoogleMapsSideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProvince: string;
  onProvinceChange: (prov: string) => void;
  onNearMeClick: () => void;
  onRegisterClick: () => void;
  onAdminClick: () => void;
  totalBusinesses: number;
}

export default function GoogleMapsSideDrawer({
  isOpen,
  onClose,
  selectedProvince,
  onProvinceChange,
  onNearMeClick,
  onRegisterClick,
  onAdminClick,
  totalBusinesses
}: GoogleMapsSideDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex transition-opacity animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer content (Google Maps menu drawer style) */}
      <div className="w-80 sm:w-96 bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-300 border-r border-slate-200">
        {/* Header with DevParadise Brand Banner */}
        <div className="p-5 bg-slate-950 text-white flex items-start justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 p-[1.5px] shadow-lg shadow-emerald-950/50">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-tr from-emerald-300 to-white text-lg font-display">
                  DP
                </span>
              </div>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white font-display flex items-center gap-1.5">
                <span>¿Dónde Pago?</span>
                <span className="text-emerald-400">Cuba</span>
              </h2>
              <p className="text-xs text-slate-400">Por DevParadise</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Main Action Cards */}
          <div className="space-y-2">
            <button
              onClick={() => {
                onClose();
                onNearMeClick();
              }}
              className="w-full p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 text-emerald-950 flex items-center justify-between group transition-all text-left shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold font-display text-emerald-950">Negocios cerca de mí</p>
                  <p className="text-[11px] text-emerald-800">Calcular distancia por GPS</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => {
                onClose();
                onRegisterClick();
              }}
              className="w-full p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between group transition-all text-left shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold font-display text-white">+ Registrar mi negocio</p>
                  <p className="text-[11px] text-slate-300">Publicación gratuita en el mapa</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Provinces Selection Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
                Provincias de Cuba
              </span>
              <span className="text-[11px] font-bold text-slate-500">{totalBusinesses} locales</span>
            </div>

            <div className="space-y-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/90">
              <button
                onClick={() => {
                  onProvinceChange('all');
                  onClose();
                }}
                className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                  selectedProvince === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>🇨🇺</span>
                  <span>Toda Cuba (Isla completa)</span>
                </div>
                {selectedProvince === 'all' && <span className="text-xs">✓</span>}
              </button>

              {CUBAN_PROVINCES.map((prov) => (
                <button
                  key={prov.name}
                  onClick={() => {
                    onProvinceChange(prov.name);
                    onClose();
                  }}
                  className={`w-full p-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                    selectedProvince === prov.name
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 opacity-60" />
                    <span>{prov.name}</span>
                  </div>
                  {selectedProvince === prov.name && <span className="text-xs font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Admin center shortcut */}
          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={() => {
                onClose();
                onAdminClick();
              }}
              className="w-full p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between text-xs font-bold transition-all shadow-md group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-extrabold text-white font-display">Administración & Aprobación</p>
                  <p className="text-[10px] text-slate-400 font-normal">Acceso restringido con clave</p>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span>🔐</span>
                <span>Admin</span>
              </span>
            </button>
          </div>

          {/* Cuban Payment Guidelines info card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-[11px] text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 font-display">
              <Info className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sobre los pagos digitales en Cuba</span>
            </div>
            <p className="leading-relaxed">
              Esta plataforma monitorea en tiempo real qué negocios aceptan Transfermóvil, EnZona y código QR, actualizados por la comunidad y el equipo DevParadise.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/90 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">¿Dónde Pago? Cuba</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ecosistema DevParadise © 2026</p>
        </div>
      </div>
    </div>
  );
}
