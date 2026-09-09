'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Store, 
  TrendingUp, 
  MapPin, 
  Eye, 
  Check, 
  Power, 
  Lock, 
  User, 
  LogOut, 
  Clock, 
  EyeOff, 
  KeyRound, 
  Sparkles,
  XCircle
} from 'lucide-react';
import { Business, CUBAN_PROVINCES } from '@/lib/cuba-data';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: Business[];
  onToggleVerify: (id: string) => void;
  onToggleTransferActive: (id: string) => void;
  onDeleteBusiness: (id: string) => void;
  onSelectBusiness: (business: Business) => void;
  onApproveBusiness?: (id: string) => void;
  onRejectBusiness?: (id: string) => void;
}

export default function AdminDashboardModal({
  isOpen,
  onClose,
  businesses,
  onToggleVerify,
  onToggleTransferActive,
  onDeleteBusiness,
  onSelectBusiness,
  onApproveBusiness,
  onRejectBusiness
}: AdminDashboardModalProps) {
  // Authentication state initialized from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tc_admin_session_auth') === 'true';
    }
    return false;
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [filterTab, setFilterTab] = useState<'pending' | 'active' | 'all' | 'verified' | 'reported'>('pending');
  const [selectedProvinceFilter, setSelectedProvinceFilter] = useState('all');

  // Compute counts
  const pendingBusinesses = businesses.filter(b => b.status === 'pending');
  const activeBusinesses = businesses.filter(b => b.status === 'active');
  const totalBusinesses = businesses.length;
  const verifiedBusinesses = businesses.filter(b => b.transferVerified).length;
  const activeTransferNow = businesses.filter(b => b.transferActiveNow && b.status === 'active').length;
  const totalReported = businesses.filter(b => b.reportsCount > 0).length;

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Accepted valid admin credentials:
    // User: 'admin' or 'administrador' or 'devparadise'
    // Pass: 'admin' or 'admin123' or 'transfercuba' or 'transfercuba2025'
    const isValidUser = cleanUser === 'admin' || cleanUser === 'administrador' || cleanUser === 'devparadise';
    const isValidPass = cleanPass === 'admin' || cleanPass === 'admin123' || cleanPass === 'transfercuba' || cleanPass === 'transfercuba2025';

    if (isValidUser && isValidPass) {
      setIsAuthenticated(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('tc_admin_session_auth', 'true');
      }
      setAuthError('');
    } else {
      setAuthError('Usuario o contraseña incorrectos. Por favor, verifica tus datos de acceso.');
    }
  };

  const handleFillDemoCredentials = () => {
    setUsername('admin');
    setPassword('admin');
    setAuthError('');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setAuthError('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tc_admin_session_auth');
    }
  };

  const filteredList = businesses.filter(biz => {
    if (selectedProvinceFilter !== 'all' && biz.province !== selectedProvinceFilter) return false;
    if (filterTab === 'pending') return biz.status === 'pending';
    if (filterTab === 'active') return biz.status === 'active';
    if (filterTab === 'verified') return biz.transferVerified;
    if (filterTab === 'reported') return biz.reportsCount > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-lg sm:rounded-xl shadow-level-4 border border-border-subtle/90 w-full max-w-4xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* =========================================================================
            VIEW 1: ADMIN LOGIN SCREEN (If not authenticated)
        ========================================================================== */}
        {!isAuthenticated ? (
          <div className="flex flex-col h-full">
            {/* Login Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-navy text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-saffron/100/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner flex-shrink-0">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold font-display text-white">Acceso de Administración</h2>
                  <p className="text-[11px] sm:text-xs text-slate-400">TransferCuba · Moderación y Aprobación</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Login Body Form */}
            <div className="p-6 sm:p-10 flex-1 flex flex-col items-center justify-center bg-slate-50/60 overflow-y-auto">
              <div className="w-full max-w-md bg-white rounded-lg p-6 sm:p-8 border border-border-subtle shadow-level-3 space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-lg bg-tm-bg border border-tm-border text-cerulean-dark flex items-center justify-center mx-auto shadow-xs">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-text-primary font-display">
                    Panel Restringido para Administradores
                  </h3>
                  <p className="text-xs text-slate-500">
                    Introduce tus credenciales para aprobar negocios pendientes y gestionar la plataforma.
                  </p>
                </div>

                {authError && (
                  <div className="p-3 rounded-xl bg-ez-bg/50 border border-ez-border text-xs text-crimson flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-crimson flex-shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">
                      Usuario
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setAuthError('');
                        }}
                        placeholder="ej. admin"
                        className="w-full text-sm pl-9 pr-3 py-2.5 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">
                      Contraseña
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setAuthError('');
                        }}
                        placeholder="••••••••"
                        className="w-full text-sm pl-9 pr-10 py-2.5 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-level-2 hover:shadow-level-2 transition-all flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Iniciar Sesión en Administración</span>
                  </button>
                </form>

                {/* Demo Credentials Quick Tip Box */}
                <div className="p-3 rounded-xl bg-tm-bg/70 border border-tm-border/80 text-xs text-blue-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-cerulean-dark" />
                      Credenciales de acceso rápido:
                    </span>
                    <button
                      type="button"
                      onClick={handleFillDemoCredentials}
                      className="text-[11px] font-bold text-cerulean-dark hover:text-blue-900 underline underline-offset-2"
                    >
                      Autocompletar
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-blue-800 bg-white/70 px-2 py-1.5 rounded-lg border border-tm-border/60 flex items-center justify-between">
                    <span>Usuario: <strong>admin</strong></span>
                    <span>Contraseña: <strong>admin</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
              VIEW 2: ADMIN CONTROL CENTER (Authenticated)
          ========================================================================== */
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-navy text-white flex items-center justify-between flex-shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cerulean/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-black text-xs sm:text-sm font-display shadow-inner flex-shrink-0">
                  DP
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-extrabold font-display text-white">DevParadise Control Center</h2>
                    <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Sesión Activa
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    Moderación y verificación de transferencias digitales en Cuba.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={handleLogout}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center gap-1.5 transition-colors"
                  title="Cerrar sesión de administrador"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cerrar sesión</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                  title="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats Metrics Cards */}
            <div className="p-3 sm:p-5 bg-slate-50 border-b border-border-subtle/80 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {/* Pending for approval Card */}
              <div 
                onClick={() => setFilterTab('pending')}
                className={`p-3 sm:p-3.5 rounded-lg border transition-all cursor-pointer shadow-xs ${
                  filterTab === 'pending'
                    ? 'bg-saffron/10/80 border-amber-400 ring-2 ring-amber-400/20 shadow-level-1'
                    : 'bg-white border-border-subtle/90 hover:border-saffron/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-saffron font-display">
                    Por Aprobar
                  </p>
                  {pendingBusinesses.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-saffron/100 animate-ping" />
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-black text-saffron mt-0.5 sm:mt-1 font-display">
                  {pendingBusinesses.length}
                </p>
                <span className="text-[10px] sm:text-[11px] text-saffron font-bold flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{pendingBusinesses.length === 1 ? '1 pendiente' : `${pendingBusinesses.length} pendientes`}</span>
                </span>
              </div>

              {/* Active Businesses */}
              <div 
                onClick={() => setFilterTab('active')}
                className={`p-3 sm:p-3.5 rounded-lg border transition-all cursor-pointer shadow-xs ${
                  filterTab === 'active'
                    ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-cerulean/40/20 shadow-level-1'
                    : 'bg-white border-border-subtle/90 hover:border-emerald-300'
                }`}
              >
                <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
                  Publicados (Activos)
                </p>
                <p className="text-xl sm:text-2xl font-black text-emerald-brand mt-0.5 sm:mt-1 font-display">{activeBusinesses.length}</p>
                <span className="text-[10px] sm:text-[11px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Visibles en mapa</span>
                </span>
              </div>

              {/* Verified Sello DP */}
              <div 
                onClick={() => setFilterTab('verified')}
                className={`p-3 sm:p-3.5 rounded-lg border transition-all cursor-pointer shadow-xs ${
                  filterTab === 'verified'
                    ? 'bg-tm-bg/80 border-blue-400 ring-2 ring-blue-400/20 shadow-level-1'
                    : 'bg-white border-border-subtle/90 hover:border-tm-border'
                }`}
              >
                <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
                  Sello Verificado
                </p>
                <p className="text-xl sm:text-2xl font-black text-cerulean-dark mt-0.5 sm:mt-1 font-display">{verifiedBusinesses}</p>
                <span className="text-[10px] sm:text-[11px] text-cerulean-dark font-bold flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Comercios auditados</span>
                </span>
              </div>

              {/* Reports */}
              <div 
                onClick={() => setFilterTab('reported')}
                className={`p-3 sm:p-3.5 rounded-lg border transition-all cursor-pointer shadow-xs ${
                  filterTab === 'reported'
                    ? 'bg-ez-bg/60 border-crimson/50 ring-2 ring-rose-400/20 shadow-level-1'
                    : 'bg-white border-border-subtle/90 hover:border-ez-border'
                }`}
              >
                <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
                  Reportes
                </p>
                <p className="text-xl sm:text-2xl font-black text-crimson mt-0.5 sm:mt-1 font-display">{totalReported}</p>
                <span className="text-[10px] sm:text-[11px] text-crimson font-bold flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Alertas ciudadanas</span>
                </span>
              </div>
            </div>

            {/* Filters and Search toolbar */}
            <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-border-subtle/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-white">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none touch-pan-x">
                <button
                  onClick={() => setFilterTab('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                    filterTab === 'pending'
                      ? 'bg-saffron/100 text-white shadow-level-1'
                      : 'bg-saffron/10 text-saffron hover:bg-amber-100 border border-saffron/30'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pendientes ({pendingBusinesses.length})</span>
                </button>

                <button
                  onClick={() => setFilterTab('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                    filterTab === 'active'
                      ? 'bg-emerald-brand text-white shadow-level-1'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Activos ({activeBusinesses.length})
                </button>

                <button
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                    filterTab === 'all'
                      ? 'bg-navy text-white shadow-level-1'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({totalBusinesses})
                </button>

                <button
                  onClick={() => setFilterTab('verified')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                    filterTab === 'verified'
                      ? 'bg-cerulean text-white shadow-level-1'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Verificados ({verifiedBusinesses})
                </button>

                <button
                  onClick={() => setFilterTab('reported')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                    filterTab === 'reported'
                      ? 'bg-crimson text-white shadow-level-1'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Reportes ({totalReported})
                </button>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-500 font-medium">Provincia:</span>
                <select
                  value={selectedProvinceFilter}
                  onChange={(e) => setSelectedProvinceFilter(e.target.value)}
                  className="text-xs py-1.5 px-3 rounded-lg border border-border-subtle/90 bg-white font-medium focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">Todas las provincias</option>
                  {CUBAN_PROVINCES.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of Businesses (Dual responsive view) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50/50">
              {filteredList.length === 0 ? (
                <div className="text-center py-16 px-4 bg-white rounded-lg border border-border-subtle space-y-2">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Store className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-600 font-display">No hay registros en esta sección</p>
                  <p className="text-xs text-slate-500">
                    {filterTab === 'pending'
                      ? '¡Excelente! No hay negocios pendientes de aprobación en este momento.'
                      : 'Prueba cambiando el filtro de estado o provincia.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* MOBILE VIEW: Touch-optimized Card Stack (< md) */}
                  <div className="block md:hidden space-y-3">
                    {filteredList.map((biz) => {
                      const isPending = biz.status === 'pending';
                      return (
                        <div 
                          key={biz.id}
                          className={`p-3.5 rounded-lg border transition-all ${
                            isPending 
                              ? 'bg-saffron/10/50 border-saffron/40 shadow-level-1' 
                              : 'bg-white border-border-subtle shadow-xs'
                          }`}
                        >
                          {/* Business info row */}
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-border-subtle flex items-center justify-center text-base flex-shrink-0">
                              {biz.category === 'comida' ? '🍕' : biz.category === 'farmacias' ? '💊' : '🏪'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="font-extrabold text-text-primary font-display text-sm truncate">
                                  {biz.name}
                                </h4>
                                {isPending ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-saffron border border-saffron/40 whitespace-nowrap flex-shrink-0">
                                    🟡 Pendiente
                                  </span>
                                ) : biz.status === 'rejected' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-crimson border border-ez-border whitespace-nowrap flex-shrink-0">
                                    Rechazado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap flex-shrink-0">
                                    🟢 Activo
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{biz.address}</p>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
                                <span className="font-bold text-slate-600">{biz.municipality}</span>
                                <span className="text-slate-400">·</span>
                                <span className="text-slate-500">{biz.province}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick toggles row */}
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-border-subtle/80">
                            <button
                              onClick={() => onToggleTransferActive(biz.id)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                                biz.transferActiveNow
                                  ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                  : 'bg-saffron/10 text-saffron border border-saffron/30'
                              }`}
                            >
                              <Power className="w-3 h-3" />
                              <span>{biz.transferActiveNow ? 'Transf. Activa' : 'Transf. Inactiva'}</span>
                            </button>

                            <button
                              onClick={() => onToggleVerify(biz.id)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                                biz.transferVerified
                                  ? 'bg-tm-bg border-tm-border text-blue-900'
                                  : 'bg-slate-50 border-border-subtle text-slate-600'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>{biz.transferVerified ? 'Verificado DP' : 'Sin verificar'}</span>
                            </button>
                          </div>

                          {/* Action Buttons Row */}
                          <div className="flex items-center gap-2 mt-3">
                            {isPending ? (
                              <>
                                <button
                                  onClick={() => onApproveBusiness?.(biz.id)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-brand hover:bg-emerald-brand text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-level-1 active:scale-95 transition-all"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Aprobar publicación</span>
                                </button>
                                <button
                                  onClick={() => onRejectBusiness?.(biz.id)}
                                  className="py-2 px-3 rounded-xl bg-ez-bg/50 hover:bg-rose-100 text-crimson border border-ez-border font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
                                >
                                  <X className="w-4 h-4" />
                                  <span>Rechazar</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    onSelectBusiness(biz);
                                    onClose();
                                  }}
                                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Ver en mapa</span>
                                </button>
                                <button
                                  onClick={() => onDeleteBusiness(biz.id)}
                                  className="p-2 rounded-xl text-rose-500 hover:bg-ez-bg/50 border border-transparent hover:border-ez-border transition-colors"
                                  title="Eliminar negocio"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP VIEW: Full Table (md+) */}
                  <div className="hidden md:block border border-border-subtle/90 rounded-lg overflow-hidden shadow-level-1 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 border-b border-border-subtle/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3.5 px-4 font-display">Negocio</th>
                          <th className="py-3.5 px-3 font-display">Ubicación</th>
                          <th className="py-3.5 px-3 font-display">Estado de Publicación</th>
                          <th className="py-3.5 px-3 font-display">Transferencia</th>
                          <th className="py-3.5 px-3 font-display">Verificado</th>
                          <th className="py-3.5 px-4 text-right font-display">Acción de Moderación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredList.map((biz) => {
                          const isPending = biz.status === 'pending';
                          return (
                            <tr key={biz.id} className={`transition-colors ${isPending ? 'bg-saffron/10/40 hover:bg-saffron/10' : 'hover:bg-slate-50/90'}`}>
                              {/* Business info */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-border-subtle/80 flex items-center justify-center font-bold text-base shadow-level-1 flex-shrink-0">
                                    {biz.category === 'comida' ? '🍕' : biz.category === 'farmacias' ? '💊' : '🏪'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-extrabold text-text-primary font-display text-sm leading-tight truncate">
                                      {biz.name}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">{biz.address}</p>
                                    {biz.whatsapp && (
                                      <p className="text-[10px] text-emerald-700 font-mono mt-0.5">WA: {biz.whatsapp}</p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Location */}
                              <td className="py-3.5 px-3 text-slate-600">
                                <span className="font-bold text-slate-600 font-display block">{biz.municipality}</span>
                                <span className="text-slate-400 text-[11px]">{biz.province}</span>
                              </td>

                              {/* Publication Status Badge */}
                              <td className="py-3.5 px-3">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-saffron border border-saffron/40">
                                    <span className="w-1.5 h-1.5 rounded-full bg-saffron/100 animate-pulse" />
                                    <span>🟡 Pendiente</span>
                                  </span>
                                ) : biz.status === 'rejected' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-crimson border border-ez-border">
                                    <XCircle className="w-3 h-3 text-crimson" />
                                    <span>Rechazado</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>🟢 Activo / Visible</span>
                                  </span>
                                )}
                              </td>

                              {/* Live Transfer Status */}
                              <td className="py-3.5 px-3">
                                <button
                                  onClick={() => onToggleTransferActive(biz.id)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                                    biz.transferActiveNow
                                      ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                      : 'bg-amber-100 text-saffron hover:bg-amber-200'
                                  }`}
                                >
                                  <Power className="w-3 h-3" />
                                  {biz.transferActiveNow ? 'Activa' : 'Inactiva'}
                                </button>
                              </td>

                              {/* Sello DevParadise */}
                              <td className="py-3.5 px-3">
                                <button
                                  onClick={() => onToggleVerify(biz.id)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                                    biz.transferVerified
                                      ? 'bg-tm-bg border-tm-border text-cerulean-dark'
                                      : 'bg-slate-50 border-border-subtle text-slate-500 hover:bg-slate-100'
                                  }`}
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  {biz.transferVerified ? 'Verificado' : 'Sin verificar'}
                                </button>
                              </td>

                              {/* Moderation Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isPending ? (
                                    <>
                                      <button
                                        onClick={() => onApproveBusiness?.(biz.id)}
                                        className="px-3 py-1.5 rounded-xl bg-emerald-brand hover:bg-emerald-brand text-white font-bold text-xs flex items-center gap-1 shadow-level-1 active:scale-95 transition-all"
                                        title="Aprobar y publicar en el mapa"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Aprobar</span>
                                      </button>
                                      <button
                                        onClick={() => onRejectBusiness?.(biz.id)}
                                        className="px-2.5 py-1.5 rounded-xl bg-ez-bg/50 hover:bg-rose-100 text-crimson border border-ez-border font-bold text-xs flex items-center gap-1 active:scale-95 transition-all"
                                        title="Rechazar publicación"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Rechazar</span>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          onSelectBusiness(biz);
                                          onClose();
                                        }}
                                        className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-text-primary transition-colors"
                                        title="Ver en mapa y detalles"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => onDeleteBusiness(biz.id)}
                                        className="p-2 rounded-xl text-rose-500 hover:bg-ez-bg/50 hover:text-crimson transition-colors"
                                        title="Eliminar registro"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-border-subtle/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="font-medium">
                  Sesión activa como <strong className="text-text-primary">admin</strong>. Los cambios aprobados se reflejan en vivo en el mapa.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-navy text-white font-bold hover:bg-slate-900 transition-colors w-full sm:w-auto"
              >
                Cerrar panel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
