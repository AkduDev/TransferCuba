'use client';

import React, { useEffect, useState } from 'react';
import ModalShell from '@/components/ModalShell';
import {
  X,
  Phone,
  Lock,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Bike,
  MessageCircle
} from 'lucide-react';
import type { AuthRole, AuthState } from '@/lib/hooks/useAuth';

interface GoogleMapsAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: AuthState;
}

const ROLE_LABELS: Record<AuthRole, string> = {
  USER: 'Usuario',
  BUSINESS: 'Negocio',
  MESSENGER: 'Mensajero',
  ADMIN: 'Administrador'
};

type Mode = 'login' | 'register';

export default function GoogleMapsAuthModal({ isOpen, onClose, auth }: GoogleMapsAuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [wantsToBeMessenger, setWantsToBeMessenger] = useState(false);
  const [showMessengerSuccess, setShowMessengerSuccess] = useState(false);

  // Reset del formulario al cerrar/abrir para no arrastrar credenciales.
  useEffect(() => {
    if (!isOpen) {
      setPhone('');
      setPin('');
      setName('');
      setShowPin(false);
      setMode('login');
      setLocalError('');
      setWantsToBeMessenger(false);
      setShowMessengerSuccess(false);
    }
  }, [isOpen]);

  const error = localError || auth.error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLocalError('');
    try {
      const ok =
        mode === 'login'
          ? await auth.login(phone, pin)
          : await auth.register(name, phone, pin, wantsToBeMessenger);
      if (ok) {
        if (mode === 'register' && wantsToBeMessenger) {
          setShowMessengerSuccess(true);
        } else {
          setPhone('');
          setPin('');
          setName('');
          onClose();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="auth-modal-title"
      describedBy="auth-modal-subtitle"
      overlayClassName="z-50 p-3 sm:p-5"
      panelClassName="bg-white rounded-xl shadow-level-4 border border-border-subtle/90 w-full max-w-md max-h-[94dvh] animate-in fade-in zoom-in-95 duration-200"
    >
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 bg-navy text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-brand/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner flex-shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base sm:text-lg font-extrabold font-display text-white">
                {auth.isAuthenticated ? 'Mi cuenta' : 'Entrar a TransferCuba'}
              </h2>
              <p id="auth-modal-subtitle" className="text-[11px] sm:text-xs text-slate-400">
                TransferCuba · Identidad y servicios locales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Registro exitoso como mensajero: pantalla de confirmación WhatsApp */}
        {showMessengerSuccess && auth.user ? (
          <div className="p-6 sm:p-8 bg-slate-50/60 flex-1 flex items-center justify-center">
            <div className="w-full bg-white rounded-lg p-6 border border-border-subtle shadow-level-3 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <Bike className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-display">¡Cuenta creada!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tu perfil de mensajero está pendiente de confirmación de pago.
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-left space-y-1.5">
                <p className="text-xs font-bold text-amber-800">Siguiente paso:</p>
                <p className="text-[11px] text-amber-700">
                  Realiza una transferencia de <strong>300 CUP</strong> al número indicado y confirma por WhatsApp.
                </p>
              </div>
              <a
                href="https://wa.me/5355819421?text=Hola%2C%20acabo%20de%20registrarme%20como%20mensajero%20y%20quiero%20confirmar%20mi%20pago."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Confirmar pago por WhatsApp
              </a>
              <button
                onClick={() => {
                  setPhone('');
                  setPin('');
                  setName('');
                  setShowMessengerSuccess(false);
                  onClose();
                }}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>

        ) : /* Autenticado: perfil */
        auth.isAuthenticated && auth.user ? (
          <div className="p-6 sm:p-8 bg-slate-50/60 flex-1 space-y-5">
            <div className="w-full bg-white rounded-lg p-6 border border-border-subtle shadow-level-3 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-brand/10 border border-emerald-brand/30 text-emerald-brand flex items-center justify-center font-black text-lg flex-shrink-0">
                  {auth.user.name.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-text-primary font-display truncate">
                    {auth.user.name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">+{auth.user.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cerulean/10 text-cerulean-dark border border-cerulean/30">
                  {ROLE_LABELS[auth.user.role]}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-brand/10 text-mint border border-emerald-brand/30">
                  {auth.user.status === 'active' ? 'Activa' : 'Bloqueada'}
                </span>
              </div>

              <button
                onClick={() => void auth.logout()}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-border-strong text-slate-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        ) : (
          /* No autenticado: login / registro */
          <div className="p-5 sm:p-8 bg-slate-50/60 flex-1 overflow-y-auto">
            <div className="w-full bg-white rounded-lg p-5 sm:p-7 border border-border-subtle shadow-level-3 space-y-5">
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setLocalError(''); }}
                  className={`py-2 text-xs font-bold rounded-md transition-colors ${
                    !isRegister ? 'bg-white text-navy shadow-level-1' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setLocalError(''); }}
                  className={`py-2 text-xs font-bold rounded-md transition-colors ${
                    isRegister ? 'bg-white text-navy shadow-level-1' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Crear cuenta
                </button>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-text-primary font-display">
                  {isRegister ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isRegister
                    ? 'Regístrate con tu teléfono y un PIN para solicitar servicios.'
                    : 'Entra con tu teléfono y PIN.'}
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-ez-bg/50 border border-ez-border text-xs text-crimson flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-crimson flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">Nombre</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => { setName(e.target.value); setLocalError(''); }}
                        placeholder="Tu nombre"
                        className="w-full text-sm pl-9 pr-3 py-2.5 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Teléfono</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setLocalError(''); }}
                      placeholder="ej. 5355551234"
                      className="w-full text-sm pl-9 pr-3 py-2.5 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">PIN</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPin ? 'text' : 'password'}
                      required
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => { setPin(e.target.value); setLocalError(''); }}
                      placeholder="4 a 8 dígitos"
                      className="w-full text-sm pl-9 pr-10 py-2.5 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      title={showPin ? 'Ocultar PIN' : 'Ver PIN'}
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isRegister && (
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-border-subtle bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={wantsToBeMessenger}
                      onChange={(e) => { setWantsToBeMessenger(e.target.checked); setLocalError(''); }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-brand focus:ring-emerald-brand/40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Bike className="w-3.5 h-3.5 text-emerald-brand" />
                        <span className="text-xs font-bold text-slate-700">Quiero ser mensajero</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Al activar, tu cuenta queda pendiente de confirmación de pago (300 CUP).
                      </p>
                    </div>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-emerald-brand hover:bg-mint disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-level-2 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmitting
                      ? 'Procesando…'
                      : isRegister
                        ? 'Crear cuenta'
                        : 'Iniciar sesión'}
                  </span>
                </button>
              </form>

              <p className="text-center text-[11px] text-slate-400">
                Tu teléfono y PIN identifican tu cuenta. No compartas tu PIN con nadie.
              </p>
            </div>
          </div>
        )}
    </ModalShell>
  );
}
