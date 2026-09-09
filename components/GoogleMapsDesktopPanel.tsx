'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Clock, 
  Phone, 
  MessageCircle, 
  Navigation, 
  ShieldCheck, 
  ThumbsUp, 
  ThumbsDown, 
  Share2, 
  Check, 
  AlertTriangle, 
  QrCode, 
  CreditCard, 
  Banknote, 
  ExternalLink,
  Store,
  ArrowLeft,
  X,
  Star
} from 'lucide-react';
import { Business, formatDistance } from '@/lib/cuba-data';
import GoogleMapsPlaceCard from '@/components/GoogleMapsPlaceCard';

interface GoogleMapsDesktopPanelProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (biz: Business | null) => void;
  onVote: (bizId: string, isConfirm: boolean) => void;
  onToggleTransferActive: (bizId: string) => void;
  onReport: (bizId: string, reason: string) => void;
  onCalculateRoute?: (biz: Business) => void;
  hasUserLocation: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export default function GoogleMapsDesktopPanel({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  onVote,
  onToggleTransferActive,
  onReport,
  onCalculateRoute,
  hasUserLocation,
  isOpen,
  onToggleOpen
}: GoogleMapsDesktopPanelProps) {
  const [copied, setCopied] = useState(false);
  const [votedType, setVotedType] = useState<'yes' | 'no' | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const handleShare = (biz: Business) => {
    if (navigator.share) {
      navigator.share({
        title: `${biz.name} | ¿Dónde Pago? Cuba`,
        text: `Consulta ${biz.name} en ${biz.municipality}, pagos digitales en Cuba.`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleVoteAction = (bizId: string, isConfirm: boolean) => {
    if (votedType) return;
    setVotedType(isConfirm ? 'yes' : 'no');
    onVote(bizId, isConfirm);
  };

  const handleSendReport = (bizId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    onReport(bizId, reportText);
    setReportSent(true);
    setTimeout(() => {
      setShowReportForm(false);
      setReportSent(false);
      setReportText('');
    }, 2000);
  };

  return (
    <aside 
      aria-label="Panel lateral estilo Google Maps"
      className={`hidden md:flex fixed top-[106px] sm:top-[110px] bottom-4 left-4 z-20 flex-col transition-all duration-300 pointer-events-auto ${
        isOpen ? 'w-[380px] lg:w-[400px] xl:w-[420px]' : 'w-0'
      }`}
    >
      {/* Panel Body */}
      <div className={`relative h-full w-full bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'
      }`}>
        {/* =========================================================================
            MODE A: SELECTED PLACE DETAILS VIEW (Google Maps Place Card)
        ========================================================================== */}
        {selectedBusiness ? (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Place Card Top Nav */}
            <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => {
                  onSelectBusiness(null);
                  setVotedType(null);
                  setShowReportForm(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600" />
                <span>Volver a resultados</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleShare(selectedBusiness)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Compartir"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => onSelectBusiness(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  title="Cerrar ficha"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4">
              {/* Photo or Banner */}
              <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-950 flex-shrink-0 shadow-inner">
                {selectedBusiness.photos && selectedBusiness.photos.length > 0 ? (
                  <Image
                    src={selectedBusiness.photos[0]}
                    alt={selectedBusiness.name}
                    fill
                    className="object-cover opacity-85"
                    referrerPolicy="no-referrer"
                    sizes="430px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-tr from-slate-950 to-emerald-950 text-white">
                    {selectedBusiness.categoryIcon}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white">
                      {selectedBusiness.category}
                    </span>
                    {selectedBusiness.transferVerified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white">
                        <ShieldCheck className="w-3 h-3" />
                        Verificado
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-extrabold text-white font-display leading-tight">
                    {selectedBusiness.name}
                  </h3>
                </div>
              </div>

              {/* Real-time Transfer status box */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                selectedBusiness.transferActiveNow 
                  ? 'bg-emerald-50/90 border-emerald-300 shadow-sm' 
                  : 'bg-amber-50/90 border-amber-300 shadow-sm'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      selectedBusiness.transferActiveNow ? 'bg-emerald-500 animate-beacon' : 'bg-amber-500'
                    }`} />
                    <div>
                      <p className={`text-xs font-extrabold font-display leading-tight ${
                        selectedBusiness.transferActiveNow ? 'text-emerald-950' : 'text-amber-950'
                      }`}>
                        {selectedBusiness.transferActiveNow 
                          ? '🟢 Transferencia disponible AHORA' 
                          : '🟡 Sin transferencia temporalmente'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Actualizado: <strong className="text-slate-700 font-semibold">{selectedBusiness.lastStatusUpdate}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleTransferActive(selectedBusiness.id)}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-950 underline underline-offset-2 flex-shrink-0"
                  >
                    Cambiar
                  </button>
                </div>
              </div>

              {/* Google Maps Action Buttons Row */}
              <div className="grid grid-cols-3 gap-2">
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/${selectedBusiness.whatsapp.replace(/[^0-9]/g, '').startsWith('53') ? selectedBusiness.whatsapp.replace(/[^0-9]/g, '') : `53${selectedBusiness.whatsapp.replace(/[^0-9]/g, '')}`}?text=${encodeURIComponent(
                    `Hola ${selectedBusiness.name}, los vi en TransferCuba. Quisiera consultar si están recibiendo pago por transferencia hoy.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-md shadow-emerald-700/20 active:scale-95 transition-all text-center gap-1"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>WhatsApp</span>
                </a>

                {/* GPS Directions - Traces OSRM route in-app */}
                <button
                  onClick={() => onCalculateRoute?.(selectedBusiness)}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-md shadow-blue-700/20 active:scale-95 transition-all text-center gap-1"
                  title="Trazar ruta en el mapa (OSRM)"
                >
                  <Navigation className="w-5 h-5" />
                  <span>Cómo llegar</span>
                </button>

                {/* Call or Share */}
                {selectedBusiness.phone ? (
                  <a
                    href={`tel:${selectedBusiness.phone}`}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] active:scale-95 transition-all text-center gap-1 border border-slate-200"
                  >
                    <Phone className="w-5 h-5 text-slate-700" />
                    <span>Llamar</span>
                  </a>
                ) : (
                  <button
                    onClick={() => handleShare(selectedBusiness)}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] active:scale-95 transition-all text-center gap-1 border border-slate-200"
                  >
                    <Share2 className="w-5 h-5 text-slate-700" />
                    <span>Compartir</span>
                  </button>
                )}
              </div>

              {/* Secondary Navigation Option: Open in external OpenStreetMap GPS */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
                <span className="text-slate-600 text-[11px]">Navegación GPS externa:</span>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${selectedBusiness.lat}&mlon=${selectedBusiness.lng}#map=16/${selectedBusiness.lat}/${selectedBusiness.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold text-[11px]"
                  title="Ver en OpenStreetMap (Libre y gratuito)"
                >
                  <span>OpenStreetMap</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Distance if GPS active */}
              {selectedBusiness.distanceMeters !== undefined && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-blue-950 text-xs font-semibold">
                  <Navigation className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>A solo <strong>{formatDistance(selectedBusiness.distanceMeters)}</strong> de tu posición actual</span>
                </div>
              )}

              {/* Address & Hours */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 text-xs text-slate-700">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">{selectedBusiness.address}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selectedBusiness.neighborhood ? `${selectedBusiness.neighborhood}, ` : ''}{selectedBusiness.municipality}, {selectedBusiness.province}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/70">
                  <Clock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-800 font-semibold">{selectedBusiness.hours}</p>
                    <p className="text-[10px] text-slate-400">Horario de atención</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedBusiness.description && (
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-display">
                    Descripción
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {selectedBusiness.description}
                  </p>
                </div>
              )}

              {/* Payment Methods Breakdown */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
                  Medios de Pago Admitidos
                </h4>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                    selectedBusiness.transferDetails.transfermovil 
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}>
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Transfermóvil</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                    selectedBusiness.transferDetails.enzona 
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}>
                    <CreditCard className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span>EnZona</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                    selectedBusiness.transferDetails.qrPayment 
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}>
                    <QrCode className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                    <span>Código QR</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                    selectedBusiness.transferDetails.cash 
                      ? 'bg-slate-50 border-slate-200 text-slate-800 font-semibold' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}>
                    <Banknote className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span>Efectivo CUP</span>
                  </div>
                </div>
              </div>

              {/* Community Confirmation Voting */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-center space-y-2.5">
                <p className="text-xs font-bold text-slate-800 font-display">
                  ¿La transferencia sigue activa hoy?
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleVoteAction(selectedBusiness.id, true)}
                    disabled={votedType !== null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      votedType === 'yes'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Sí ({selectedBusiness.confirmationsCount + (votedType === 'yes' ? 1 : 0)})</span>
                  </button>

                  <button
                    onClick={() => handleVoteAction(selectedBusiness.id, false)}
                    disabled={votedType !== null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      votedType === 'no'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-white text-rose-800 border border-rose-300 hover:bg-rose-50'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>No ({selectedBusiness.reportsCount + (votedType === 'no' ? 1 : 0)})</span>
                  </button>
                </div>
                {votedType && (
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    ✓ ¡Gracias por tu confirmación comunitaria!
                  </p>
                )}
              </div>

              {/* Report button */}
              <div className="text-center pt-1 pb-2">
                {!showReportForm ? (
                  <button
                    onClick={() => setShowReportForm(true)}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold flex items-center justify-center gap-1 mx-auto"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Reportar cambio o error en este local</span>
                  </button>
                ) : (
                  <form onSubmit={(e) => handleSendReport(selectedBusiness.id, e)} className="p-3 bg-rose-50/80 rounded-2xl border border-rose-200 text-left space-y-2">
                    <p className="text-xs font-bold text-rose-950 font-display">Reportar a moderación</p>
                    <textarea
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      placeholder="Indica qué cambió (no aceptan transfer, teléfono cambiado...)"
                      className="w-full text-xs p-2 rounded-xl border border-rose-200 bg-white focus:outline-none"
                      rows={2}
                      required
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowReportForm(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-white rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                      >
                        {reportSent ? '¡Enviado!' : 'Enviar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
              MODE B: SEARCH RESULTS LIST (Google Maps Search Results Drawer)
          ========================================================================== */
          <div className="h-full flex flex-col overflow-hidden">
            {/* Results Header Count & Micro Status */}
            <div className="px-4 py-3 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200/90 flex items-center justify-between flex-shrink-0">
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-slate-900 font-display">
                  {businesses.length} {businesses.length === 1 ? 'lugar encontrado' : 'lugares encontrados'}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  {businesses.filter(b => b.transferActiveNow).length} con transferencia activa
                </span>
              </div>
              {hasUserLocation && (
                <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 shadow-xs">
                  <Navigation className="w-3 h-3 text-blue-600" />
                  <span>Cercanos</span>
                </span>
              )}
            </div>

            {/* List of Places */}
            <div className="flex-1 overflow-y-auto bg-white divide-y-0">
              {businesses.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-3">
                  <div className="w-14 h-14 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
                    <Store className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 font-display">No hay resultados en esta zona</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Prueba cambiando la provincia en la barra superior o buscando otro término como farmacia, cafetería o taller.
                  </p>
                </div>
              ) : (
                businesses.map((biz) => (
                  <GoogleMapsPlaceCard
                    key={biz.id}
                    business={biz}
                    isSelected={false}
                    onSelect={onSelectBusiness}
                    onCalculateRoute={onCalculateRoute}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Google Maps Chevron Toggle Button (The iconic < / > pill that collapses panel) */}
      <button
        onClick={onToggleOpen}
        id="btn-gm-collapse-panel"
        aria-label={isOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
        className="absolute top-1/2 -translate-y-1/2 -right-4 z-30 w-8 h-12 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 rounded-r-xl shadow-xl border-y border-r border-slate-200/90 flex items-center justify-center transition-transform hover:scale-105"
        title={isOpen ? 'Ocultar panel (Ver mapa completo)' : 'Mostrar panel de resultados'}
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </aside>
  );
}
