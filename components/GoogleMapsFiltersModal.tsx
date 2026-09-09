'use client';

import React from 'react';
import { 
  X, 
  MapPin, 
  RotateCcw, 
  Check, 
  CreditCard, 
  QrCode, 
  Globe, 
  SlidersHorizontal 
} from 'lucide-react';
import { CUBAN_PROVINCES, CATEGORIES } from '@/lib/cuba-data';

interface GoogleMapsFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProvince: string;
  onProvinceChange: (p: string) => void;
  selectedMunicipality: string;
  onMunicipalityChange: (m: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  onlyActiveNow: boolean;
  onToggleOnlyActiveNow: () => void;
  onlyTransfer: boolean;
  onToggleOnlyTransfer: () => void;
  filterQr: boolean;
  onToggleFilterQr: () => void;
  filterOnline: boolean;
  onToggleFilterOnline: () => void;
  filterVerification: string;
  onFilterVerificationChange: (v: string) => void;
  onResetFilters: () => void;
  totalResults: number;
}

export default function GoogleMapsFiltersModal({
  isOpen,
  onClose,
  selectedProvince,
  onProvinceChange,
  selectedMunicipality,
  onMunicipalityChange,
  selectedCategory,
  onCategoryChange,
  onlyActiveNow,
  onToggleOnlyActiveNow,
  onlyTransfer,
  onToggleOnlyTransfer,
  filterQr,
  onToggleFilterQr,
  filterOnline,
  onToggleFilterOnline,
  filterVerification,
  onFilterVerificationChange,
  onResetFilters,
  totalResults
}: GoogleMapsFiltersModalProps) {
  if (!isOpen) return null;

  const currentProvinceData = CUBAN_PROVINCES.find(p => p.name === selectedProvince);
  const municipalities = currentProvinceData ? currentProvinceData.municipalities : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 transition-opacity animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-lg sm:rounded-xl shadow-level-4 border border-border-subtle flex flex-col max-h-[90dvh] sm:max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-brand" />
            <h3 className="font-extrabold text-text-primary font-display text-sm sm:text-base">
              Filtros de Búsqueda
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Geographical Area */}
          <div className="space-y-2">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
              Zona en Cuba
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-1">Provincia</label>
                <select
                  value={selectedProvince}
                  onChange={(e) => onProvinceChange(e.target.value)}
                  className="w-full py-2 px-2.5 rounded-lg border border-border-subtle bg-slate-50 font-medium text-text-primary focus:bg-white focus:outline-none"
                >
                  <option value="all">🇨🇺 Toda Cuba</option>
                  {CUBAN_PROVINCES.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-1">Municipio</label>
                <select
                  disabled={selectedProvince === 'all'}
                  value={selectedMunicipality}
                  onChange={(e) => onMunicipalityChange(e.target.value)}
                  className="w-full py-2 px-2.5 rounded-lg border border-border-subtle bg-slate-50 font-medium text-text-primary focus:bg-white focus:outline-none disabled:opacity-40"
                >
                  <option value="all">Todos los municipios</option>
                  {municipalities.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
              Categoría
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange(cat.id)}
                    className={`p-2 rounded-lg border text-left font-medium flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-navy text-white border-slate-950 shadow-level-1'
                        : 'bg-slate-50 border-border-subtle text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.icon === 'Store' ? '🏬' : cat.icon === 'Utensils' ? '🍕' : cat.icon === 'ShoppingBag' ? '🛒' : cat.icon === 'Pill' ? '💊' : cat.icon === 'Coffee' ? '☕' : cat.icon === 'Smartphone' ? '📱' : cat.icon === 'Wrench' ? '🔧' : '👕'}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Cuban Feature: ¿Acepta transferencia AHORA? */}
          <div
            onClick={onToggleOnlyActiveNow}
            role="button"
            tabIndex={0}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
              onlyActiveNow 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-level-1' 
                : 'bg-slate-50 border-border-subtle text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${onlyActiveNow ? 'bg-emerald-500 animate-beacon' : 'bg-slate-400'}`} />
              <div>
                <p className="font-bold text-xs">🟢 Solo con transferencia activa AHORA</p>
                <p className="text-[11px] text-slate-500">Excluir comercios con señal caída o sin sistema hoy</p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center border ${
              onlyActiveNow ? 'bg-emerald-brand border-emerald-600 text-white' : 'border-border-strong bg-white'
            }`}>
              {onlyActiveNow && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>

          {/* Verification Status */}
          <div className="space-y-2">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
              Estado de Verificación
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'verified', label: '🟢 Verificados' },
                { id: 'pending', label: '🟡 Pendientes' },
                { id: 'reported', label: '🔴 Reportados' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => onFilterVerificationChange(item.id)}
                  className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold transition-all text-center ${
                    filterVerification === item.id
                      ? 'bg-navy text-white border-slate-950'
                      : 'bg-slate-50 border-border-subtle text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment gateways */}
          <div className="space-y-2">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
              Canales de Pago
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={onToggleOnlyTransfer}
                className={`p-2.5 rounded-lg border font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                  onlyTransfer ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-slate-50 border-border-subtle text-slate-600'
                }`}
              >
                <CreditCard className="w-4 h-4 text-emerald-brand" />
                <span className="text-[10px] text-center">Transfermóvil / EnZona</span>
              </button>

              <button
                onClick={onToggleFilterQr}
                className={`p-2.5 rounded-lg border font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                  filterQr ? 'bg-indigo-50 border-indigo-300 text-indigo-950' : 'bg-slate-50 border-border-subtle text-slate-600'
                }`}
              >
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px]">Código QR</span>
              </button>

              <button
                onClick={onToggleFilterOnline}
                className={`p-2.5 rounded-lg border font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                  filterOnline ? 'bg-purple-50 border-purple-300 text-purple-950' : 'bg-slate-50 border-border-subtle text-slate-600'
                }`}
              >
                <Globe className="w-4 h-4 text-purple-600" />
                <span className="text-[10px]">Pasarela web</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-border-subtle flex items-center justify-between">
          <button
            onClick={onResetFilters}
            className="text-xs font-bold text-slate-500 hover:text-slate-600 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer todo</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-level-2 active:scale-95 transition-all"
          >
            Ver {totalResults} {totalResults === 1 ? 'resultado' : 'resultados'}
          </button>
        </div>
      </div>
    </div>
  );
}
