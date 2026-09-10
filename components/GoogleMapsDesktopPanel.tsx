'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Navigation,
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
  BadgeCheck,
  Zap
} from 'lucide-react';
import { Business, formatDistance } from '@/lib/cuba-data';
import GoogleMapsPlaceCard from '@/components/GoogleMapsPlaceCard';
import BusinessCover from '@/components/BusinessCover';

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

  const waLink = (biz: Business, msg: string) =>
    `https://wa.me/${
      biz.whatsapp.replace(/[^0-9]/g, '').startsWith('53')
        ? biz.whatsapp.replace(/[^0-9]/g, '')
        : `53${biz.whatsapp.replace(/[^0-9]/g, '')}`
    }?text=${encodeURIComponent(msg)}`;

  const paymentRow = (
    active: boolean,
    Icon: React.ComponentType<{ className?: string }>,
    label: string,
    color: string
  ) => (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-semibold ${
        active
          ? `bg-white border-border-subtle text-text-primary ${color}`
          : 'bg-slate-50 border-transparent text-slate-400 opacity-60'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
      {active && <Check className="w-3.5 h-3.5 ml-auto text-emerald-brand" />}
    </div>
  );

  return (
    <aside
      aria-label="Panel lateral de resultados"
      className={`hidden md:flex fixed top-[118px] bottom-4 left-6 z-20 flex-col transition-all duration-300 pointer-events-auto ${
        isOpen ? 'w-[400px] lg:w-[440px] xl:w-[480px]' : 'w-0'
      }`}
    >
      <div
        className={`relative h-full w-full bg-canvas border border-border-subtle rounded-xl shadow-level-4 flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'
        }`}
      >
        {selectedBusiness ? (
          /* ================= MODO FICHA DETALLE ================= */
          <div className="h-full flex flex-col overflow-hidden bg-white">
            {/* Header nav */}
            <div className="px-4 py-3 bg-white border-b border-border-subtle flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => {
                  onSelectBusiness(null);
                  setVotedType(null);
                  setShowReportForm(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Resultados</span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleShare(selectedBusiness)}
                  className="p-2 rounded-lg text-slate-500 hover:text-navy hover:bg-slate-100 transition-colors"
                  title="Compartir"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-brand" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => onSelectBusiness(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-navy hover:bg-slate-100 transition-colors"
                  title="Cerrar ficha"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Hero compacto: foto real (lazy) o placeholder por categoría */}
              <div className="relative h-40 flex-shrink-0">
                <BusinessCover
                  business={selectedBusiness}
                  className="w-full h-full"
                  rounded="rounded-none"
                  sizes="480px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy-deep/25 to-transparent" />
                <div className="absolute bottom-3.5 left-4 right-4 text-white">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-cerulean text-white text-[10px] font-bold uppercase tracking-wide">
                      {selectedBusiness.category}
                    </span>
                    {selectedBusiness.transferVerified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-brand text-white text-[10px] font-bold">
                        <BadgeCheck className="w-3 h-3" />
                        Verificado
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-extrabold leading-tight">{selectedBusiness.name}</h3>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Estado transferencia */}
                <div
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                    selectedBusiness.transferActiveNow
                      ? 'bg-emerald-brand/5 border-emerald-brand/30'
                      : 'bg-saffron/5 border-saffron/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        selectedBusiness.transferActiveNow
                          ? 'bg-emerald-brand animate-beacon'
                          : 'bg-saffron'
                      }`}
                    />
                    <div>
                      <p
                        className={`text-[13px] font-bold leading-tight ${
                          selectedBusiness.transferActiveNow ? 'text-emerald-brand' : 'text-saffron'
                        }`}
                      >
                        {selectedBusiness.transferActiveNow
                          ? 'Transferencia disponible'
                          : 'Sin transferencia ahora'}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {selectedBusiness.lastStatusUpdate}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleTransferActive(selectedBusiness.id)}
                    className="text-[11px] font-bold text-slate-500 hover:text-navy underline underline-offset-2 flex-shrink-0"
                  >
                    Cambiar
                  </button>
                </div>

                {/* CTAs */}
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={waLink(
                      selectedBusiness,
                      `Hola ${selectedBusiness.name}, los vi en TransferCuba. ¿Están recibiendo pago por transferencia hoy?`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-emerald-brand hover:bg-emerald-600 text-white font-bold text-[11px] shadow-level-1 active:scale-95 transition-all gap-1"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>WhatsApp</span>
                  </a>
                  <button
                    onClick={() => onCalculateRoute?.(selectedBusiness)}
                    className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-cerulean hover:bg-cerulean-dark text-white font-bold text-[11px] shadow-level-1 active:scale-95 transition-all gap-1"
                    title="Trazar ruta (OSRM)"
                  >
                    <Navigation className="w-5 h-5" />
                    <span>Cómo llegar</span>
                  </button>
                  {selectedBusiness.phone ? (
                    <a
                      href={`tel:${selectedBusiness.phone}`}
                      className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white border border-border-subtle hover:bg-slate-50 text-navy font-bold text-[11px] shadow-level-1 active:scale-95 transition-all gap-1"
                    >
                      <Phone className="w-5 h-5" />
                      <span>Llamar</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => handleShare(selectedBusiness)}
                      className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white border border-border-subtle hover:bg-slate-50 text-navy font-bold text-[11px] shadow-level-1 active:scale-95 transition-all gap-1"
                    >
                      <Share2 className="w-5 h-5" />
                      <span>Compartir</span>
                    </button>
                  )}
                </div>

                {/* Datos esenciales */}
                <div className="rounded-lg border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                  <div className="flex items-start gap-2.5 px-3.5 py-3 text-xs">
                    <MapPin className="w-4 h-4 text-cerulean mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-text-primary">{selectedBusiness.address}</p>
                      <p className="text-text-muted mt-0.5">
                        {selectedBusiness.neighborhood ? `${selectedBusiness.neighborhood}, ` : ''}
                        {selectedBusiness.municipality}, {selectedBusiness.province}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 px-3.5 py-3 text-xs">
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-slate-700 font-semibold">{selectedBusiness.hours}</p>
                      <p className="text-[10px] text-text-muted">Horario</p>
                    </div>
                  </div>
                  {selectedBusiness.distanceMeters !== undefined && (
                    <div className="flex items-center gap-2.5 px-3.5 py-3 text-xs">
                      <Navigation className="w-4 h-4 text-cerulean flex-shrink-0" />
                      <span className="text-slate-700 font-semibold">
                        A {formatDistance(selectedBusiness.distanceMeters)} de ti
                      </span>
                    </div>
                  )}
                </div>

                {selectedBusiness.description && (
                  <p className="text-xs text-slate-600 leading-relaxed px-1">
                    {selectedBusiness.description}
                  </p>
                )}

                {/* Medios de pago */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2 px-1">
                    Medios de pago
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentRow(
                      selectedBusiness.transferDetails.transfermovil,
                      CreditCard,
                      'Transfermóvil',
                      'text-tm-text'
                    )}
                    {paymentRow(selectedBusiness.transferDetails.enzona, CreditCard, 'EnZona', 'text-ez-text')}
                    {paymentRow(selectedBusiness.transferDetails.qrPayment, QrCode, 'Código QR', 'text-qr-text')}
                    {paymentRow(selectedBusiness.transferDetails.cash, Banknote, 'Efectivo CUP', 'text-ash-text')}
                  </div>
                </div>

                {/* Votación comunitaria */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-border-subtle text-center space-y-2.5">
                  <p className="text-xs font-bold text-text-primary">
                    ¿La transferencia sigue activa hoy?
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleVoteAction(selectedBusiness.id, true)}
                      disabled={votedType !== null}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        votedType === 'yes'
                          ? 'bg-emerald-brand border-emerald-brand text-white shadow-level-2'
                          : 'bg-white border-border-subtle text-emerald-brand hover:bg-emerald-50'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Sí ({selectedBusiness.confirmationsCount + (votedType === 'yes' ? 1 : 0)})</span>
                    </button>
                    <button
                      onClick={() => handleVoteAction(selectedBusiness.id, false)}
                      disabled={votedType !== null}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        votedType === 'no'
                          ? 'bg-crimson border-crimson text-white shadow-level-2'
                          : 'bg-white border-border-subtle text-crimson hover:bg-ez-bg'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>No ({selectedBusiness.reportsCount + (votedType === 'no' ? 1 : 0)})</span>
                    </button>
                  </div>
                  {votedType && (
                    <p className="text-[11px] text-emerald-brand font-semibold">
                      ¡Gracias por tu confirmación!
                    </p>
                  )}
                </div>

                {/* Reporte + OSM externo */}
                <div className="space-y-2">
                  {!showReportForm ? (
                    <button
                      onClick={() => setShowReportForm(true)}
                      className="text-[11px] text-slate-400 hover:text-crimson font-semibold flex items-center justify-center gap-1 mx-auto"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Reportar cambio o error</span>
                    </button>
                  ) : (
                    <form
                      onSubmit={(e) => handleSendReport(selectedBusiness.id, e)}
                      className="p-3 bg-ez-bg/60 rounded-lg border border-ez-border space-y-2 text-left"
                    >
                      <p className="text-xs font-bold text-crimson">Reportar a moderación</p>
                      <textarea
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Indica qué cambió (no aceptan transfer, teléfono cambiado…)"
                        className="w-full text-xs p-2 rounded-md border border-ez-border bg-white focus:outline-none focus:ring-2 focus:ring-crimson/20"
                        rows={2}
                        required
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowReportForm(false)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:bg-white rounded-md"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 text-xs font-bold bg-crimson text-white rounded-md hover:bg-crimson/90"
                        >
                          {reportSent ? '¡Enviado!' : 'Enviar'}
                        </button>
                      </div>
                    </form>
                  )}

                  <a
                    href={`https://www.openstreetmap.org/?mlat=${selectedBusiness.lat}&mlon=${selectedBusiness.lng}#map=16/${selectedBusiness.lat}/${selectedBusiness.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 text-[11px] text-slate-400 hover:text-cerulean-dark font-semibold mx-auto"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver en OpenStreetMap</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= MODO LISTA RESULTADOS ================= */
          <div className="h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 bg-white border-b border-border-subtle flex items-center justify-between flex-shrink-0">
              <div className="flex flex-col">
                <span className="text-sm font-extrabold text-text-primary">
                  {businesses.length} {businesses.length === 1 ? 'lugar' : 'lugares'}
                </span>
                <span className="text-[11px] text-emerald-brand font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {businesses.filter((b) => b.transferActiveNow).length} con transferencia activa
                </span>
              </div>
              {hasUserLocation && (
                <span className="text-[11px] font-bold text-cerulean-dark flex items-center gap-1 bg-tm-bg px-2.5 py-1 rounded-full border border-tm-border">
                  <Navigation className="w-3 h-3" />
                  Ordenados por cercanía
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-canvas">
              {businesses.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-slate-100 border border-border-subtle flex items-center justify-center mx-auto text-slate-400">
                    <Store className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-text-primary">No hay resultados en esta zona</p>
                  <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
                    Prueba cambiando la provincia o buscando otro término como farmacia, cafetería o
                    taller.
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

      {/* Toggle colapsar panel */}
      <button
        onClick={onToggleOpen}
        aria-label={isOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
        className="absolute top-1/2 -translate-y-1/2 -right-4 z-30 w-7 h-12 bg-white hover:bg-slate-50 text-slate-600 rounded-r-lg shadow-level-3 border-y border-r border-border-subtle flex items-center justify-center transition-all hover:text-navy"
        title={isOpen ? 'Ocultar panel (mapa completo)' : 'Mostrar resultados'}
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </aside>
  );
}
