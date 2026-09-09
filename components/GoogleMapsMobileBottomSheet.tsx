'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  ChevronUp, 
  ChevronDown, 
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
  Store,
  X,
  Sparkles,
  Star
} from 'lucide-react';
import { Business, formatDistance } from '@/lib/cuba-data';
import GoogleMapsPlaceCard from '@/components/GoogleMapsPlaceCard';

interface GoogleMapsMobileBottomSheetProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (biz: Business | null) => void;
  onVote: (bizId: string, isConfirm: boolean) => void;
  onToggleTransferActive: (bizId: string) => void;
  onReport: (bizId: string, reason: string) => void;
  onCalculateRoute?: (biz: Business) => void;
  hasUserLocation: boolean;
  sheetState?: 'peek' | 'half' | 'full';
  onSheetStateChange?: (state: 'peek' | 'half' | 'full') => void;
}

type SheetState = 'peek' | 'half' | 'full';

export default function GoogleMapsMobileBottomSheet({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  onVote,
  onToggleTransferActive,
  onReport,
  onCalculateRoute,
  hasUserLocation,
  sheetState: externalSheetState,
  onSheetStateChange
}: GoogleMapsMobileBottomSheetProps) {
  // Height state: 'peek' | 'half' | 'full'
  const [internalSheetState, setInternalSheetState] = useState<SheetState>('peek');
  const sheetState = externalSheetState ?? internalSheetState;

  const setSheetState = (state: SheetState) => {
    setInternalSheetState(state);
    onSheetStateChange?.(state);
  };

  const [copied, setCopied] = useState(false);
  const [votedType, setVotedType] = useState<'yes' | 'no' | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);

  // Sync state when selected business changes using React's render-time pattern
  const [prevBusinessId, setPrevBusinessId] = useState<string | null>(null);
  const currentBusinessId = selectedBusiness?.id ?? null;
  if (currentBusinessId !== prevBusinessId) {
    setPrevBusinessId(currentBusinessId);
    setSheetState('peek');
    setVotedType(null);
    setShowReportForm(false);
  }

  // Touch drag tracking
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0].clientY;
    const diff = endY - touchStartY.current;

    // Swiped down
    if (diff > 40) {
      if (sheetState === 'full') setSheetState('half');
      else if (sheetState === 'half') setSheetState('peek');
    } 
    // Swiped up
    else if (diff < -40) {
      if (sheetState === 'peek') setSheetState('half');
      else if (sheetState === 'half') setSheetState('full');
    }
    touchStartY.current = null;
  };

  const toggleExpand = () => {
    if (sheetState === 'peek') setSheetState('half');
    else if (sheetState === 'half') setSheetState('full');
    else setSheetState('peek');
  };

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

  // Determine height classes based on state and whether a place is selected
  const heightClass = (() => {
    if (sheetState === 'full') return 'h-[88vh] max-h-[88dvh]';
    if (sheetState === 'half') return 'h-[50vh] max-h-[50dvh]';
    // Peek state:
    return selectedBusiness ? 'h-[212px] sm:h-[220px] max-h-[42dvh]' : 'h-[70px] sm:h-[74px]';
  })();

  return (
    <div
      className={`md:hidden fixed bottom-0 inset-x-0 z-30 bg-white rounded-t-2xl shadow-level-4 border-t border-border-subtle flex flex-col transition-[height] duration-300 ease-out overflow-hidden pointer-events-auto pb-[env(safe-area-inset-bottom,0px)] ${heightClass}`}
    >
      {/* Google Maps Drag Pill Handle Header with enhanced touch target */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={toggleExpand}
        className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-pointer select-none flex-shrink-0 bg-white active:bg-slate-50 touch-pan-y"
        aria-label="Arrastrar o expandir panel"
      >
        <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
      </div>

      {/* =========================================================================
          SELECTED PLACE BOTTOM SHEET (Mobile Place Card)
      ========================================================================== */}
      {selectedBusiness ? (
        <div className="flex-1 flex flex-col overflow-hidden px-3.5 sm:px-4 pb-2 sm:pb-3">
          {/* Top Summary Row (Visible in Peek, Half, and Full) */}
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 flex-shrink-0">
            <div className="flex-1 min-w-0" onClick={toggleExpand}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs">{selectedBusiness.categoryIcon}</span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {selectedBusiness.category}
                </span>
                {selectedBusiness.transferVerified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                )}
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-display truncate">
                {selectedBusiness.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] sm:text-[11px]">
                <span className={`inline-flex items-center gap-1 font-bold ${
                  selectedBusiness.transferActiveNow ? 'text-emerald-brand' : 'text-saffron'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${selectedBusiness.transferActiveNow ? 'bg-emerald-brand animate-beacon' : 'bg-saffron'}`} />
                  <span className="truncate">{selectedBusiness.transferActiveNow ? 'Transferencia activa hoy' : 'Sin transferencia'}</span>
                </span>
                {selectedBusiness.distanceMeters !== undefined && (
                  <span className="text-cerulean-dark font-bold bg-tm-bg px-1.5 py-0.5 rounded border border-tm-border flex-shrink-0">
                    {formatDistance(selectedBusiness.distanceMeters)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={toggleExpand}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 bg-slate-100 active:scale-95 transition-transform"
                title={sheetState === 'peek' ? 'Ver más' : 'Minimizar'}
              >
                {sheetState === 'peek' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onSelectBusiness(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 bg-slate-100 active:scale-95 transition-transform"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick CTA Action Row (Always visible in peek mode!) */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 py-2 flex-shrink-0">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/${selectedBusiness.whatsapp.replace(/[^0-9]/g, '').startsWith('53') ? selectedBusiness.whatsapp.replace(/[^0-9]/g, '') : `53${selectedBusiness.whatsapp.replace(/[^0-9]/g, '')}`}?text=${encodeURIComponent(
                `Hola ${selectedBusiness.name}, los vi en ¿Dónde Pago? Cuba. Quisiera consultar si aceptan transferencia hoy.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 rounded-lg bg-emerald-brand text-white font-bold text-[11px] sm:text-xs shadow-level-1 active:scale-95 transition-all text-center whitespace-nowrap min-h-[38px]"
            >
              <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>WhatsApp</span>
            </a>

            {/* Directions - In-app OSRM route calculation */}
            <button
              onClick={() => {
                onCalculateRoute?.(selectedBusiness);
                setSheetState('peek');
              }}
              className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 rounded-lg bg-cerulean text-white font-bold text-[11px] sm:text-xs shadow-level-1 active:scale-95 transition-all text-center whitespace-nowrap min-h-[38px]"
              title="Trazar ruta en el mapa (OSRM)"
            >
              <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>Ruta</span>
            </button>

            {/* Phone or Share */}
            {selectedBusiness.phone ? (
              <a
                href={`tel:${selectedBusiness.phone}`}
                className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 rounded-lg bg-white text-navy font-bold text-[11px] sm:text-xs border border-border-subtle active:scale-95 transition-all text-center whitespace-nowrap min-h-[38px]"
              >
                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 flex-shrink-0" />
                <span>Llamar</span>
              </a>
            ) : (
              <button
                onClick={() => handleShare(selectedBusiness)}
                className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 rounded-lg bg-white text-navy font-bold text-[11px] sm:text-xs border border-border-subtle active:scale-95 transition-all text-center whitespace-nowrap min-h-[38px]"
              >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 flex-shrink-0" />
                <span>{copied ? 'Copiado' : 'Compartir'}</span>
              </button>
            )}
          </div>

          {/* Expanded Scrollable Details (Visible when sheet is half or full) */}
          {sheetState !== 'peek' && (
            <div className="flex-1 overflow-y-auto space-y-3.5 pt-2 pb-6">
              {/* Photo banner */}
              {selectedBusiness.photos && selectedBusiness.photos.length > 0 && (
                <div className="relative h-36 rounded-2xl overflow-hidden bg-slate-950 flex-shrink-0 shadow-inner">
                  <Image
                    src={selectedBusiness.photos[0]}
                    alt={selectedBusiness.name}
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                    sizes="400px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                </div>
              )}

              {/* Address & Hours */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">{selectedBusiness.address}</p>
                    <p className="text-[11px] text-slate-500">
                      {selectedBusiness.neighborhood ? `${selectedBusiness.neighborhood}, ` : ''}{selectedBusiness.municipality}, {selectedBusiness.province}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200">
                  <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="font-medium">{selectedBusiness.hours}</span>
                </div>
              </div>

              {/* Payment Gateways breakdown */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200/90 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
                  Medios de pago en Cuba
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                    selectedBusiness.transferDetails.transfermovil 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}>
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Transfermóvil</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                    selectedBusiness.transferDetails.enzona 
                      ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}>
                    <CreditCard className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span>EnZona</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                    selectedBusiness.transferDetails.qrPayment 
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}>
                    <QrCode className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                    <span>Código QR</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                    selectedBusiness.transferDetails.cash 
                      ? 'bg-slate-50 border-slate-200 text-slate-800 font-semibold' 
                      : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
                  }`}>
                    <Banknote className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span>Efectivo</span>
                  </div>
                </div>
              </div>

              {/* Community voting */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 text-center space-y-2">
                <p className="text-xs font-bold text-slate-800 font-display">
                  ¿Aceptan transferencia hoy?
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleVoteAction(selectedBusiness.id, true)}
                    disabled={votedType !== null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                      votedType === 'yes' ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-300 text-emerald-800'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Sí ({selectedBusiness.confirmationsCount + (votedType === 'yes' ? 1 : 0)})</span>
                  </button>

                  <button
                    onClick={() => handleVoteAction(selectedBusiness.id, false)}
                    disabled={votedType !== null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                      votedType === 'no' ? 'bg-rose-600 text-white' : 'bg-white border border-rose-300 text-rose-800'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>No ({selectedBusiness.reportsCount + (votedType === 'no' ? 1 : 0)})</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
            RESULTS LIST BOTTOM SHEET (Mobile Place List)
        ========================================================================== */
        <div className="flex-1 flex flex-col overflow-hidden px-3.5 pb-2">
          {/* Peek Summary Bar */}
          <div
            onClick={toggleExpand}
            className="flex items-center justify-between py-1.5 cursor-pointer flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-brand animate-pulse" />
              <span className="text-xs font-extrabold text-text-primary">
                {businesses.length} {businesses.length === 1 ? 'negocio' : 'negocios'}
              </span>
              <span className="text-[10px] text-emerald-brand font-bold bg-emerald-brand/10 px-2 py-0.5 rounded-full">
                {businesses.filter((b) => b.transferActiveNow).length} activos
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-cerulean-dark bg-tm-bg px-2.5 py-1 rounded-full border border-tm-border">
              <span>{sheetState === 'peek' ? 'Ver lista' : 'Minimizar'}</span>
              {sheetState === 'peek' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>

          {/* Scrollable list of cards when half or full */}
          {sheetState !== 'peek' && (
            <div className="flex-1 overflow-y-auto bg-canvas -mx-3.5 p-3 pb-12 space-y-2.5">
              {businesses.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                    <Store className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 font-display">No hay negocios en esta zona</p>
                  <p className="text-[11px] text-slate-500">Prueba cambiando la provincia en la barra superior.</p>
                </div>
              ) : (
                businesses.map((biz) => (
                  <GoogleMapsPlaceCard
                    key={biz.id}
                    business={biz}
                    isSelected={false}
                    onSelect={onSelectBusiness}
                    onCalculateRoute={(b) => {
                      onCalculateRoute?.(b);
                      setSheetState('peek');
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
