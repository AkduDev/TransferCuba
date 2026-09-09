'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  X, 
  MapPin, 
  Clock, 
  Phone, 
  MessageCircle, 
  Navigation, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Share2,
  Check,
  AlertTriangle,
  QrCode,
  CreditCard,
  Banknote,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Business, formatDistance } from '@/lib/cuba-data';

interface BusinessDetailModalProps {
  business: Business | null;
  onClose: () => void;
  onVote: (businessId: string, isConfirm: boolean) => void;
  onToggleTransferActive: (businessId: string) => void;
  onReport: (businessId: string, reason: string) => void;
}

export default function BusinessDetailModal({
  business,
  onClose,
  onVote,
  onToggleTransferActive,
  onReport
}: BusinessDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [votedType, setVotedType] = useState<'yes' | 'no' | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);

  if (!business) return null;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${business.name} | ¿Dónde Pago? Cuba`,
        text: `Consulta ${business.name} en ${business.municipality}, acepta transferencias en Cuba.`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleVoteAction = (isConfirm: boolean) => {
    if (votedType) return;
    setVotedType(isConfirm ? 'yes' : 'no');
    onVote(business.id, isConfirm);
  };

  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    onReport(business.id, reportText);
    setReportSent(true);
    setTimeout(() => {
      setShowReportForm(false);
      setReportSent(false);
      setReportText('');
    }, 2000);
  };

  // WhatsApp click handler with pre-formatted message
  const whatsappDigits = business.whatsapp.replace(/[^0-9]/g, '');
  const cleanNumber = whatsappDigits.startsWith('53') ? whatsappDigits : `53${whatsappDigits}`;
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
    `Hola ${business.name}, los vi en la plataforma ¿Dónde Pago? Cuba de DevParadise. Quisiera consultar disponibilidad y confirmar si están recibiendo pago por transferencia hoy. ¡Muchas gracias!`
  )}`;

  // Navigation directions link (OpenStreetMap - 100% Free & Open)
  const directionsUrl = `https://www.openstreetmap.org/?mlat=${business.lat}&mlon=${business.lng}#map=16/${business.lat}/${business.lng}`;

  return (
    <aside 
      aria-label="Ficha del negocio" 
      className="fixed inset-y-0 right-0 z-40 w-full sm:max-w-md md:max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 animate-in slide-in-from-right overflow-hidden"
    >
      {/* Top Banner Header */}
      <div className="relative h-48 sm:h-56 bg-slate-950 overflow-hidden flex-shrink-0">
        {business.photos && business.photos.length > 0 ? (
          <Image
            src={business.photos[0]}
            alt={business.name}
            fill
            className="object-cover opacity-80"
            referrerPolicy="no-referrer"
            sizes="(max-width: 768px) 100vw, 500px"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center text-white text-6xl">
            {business.categoryIcon}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />

        {/* Action buttons (Share & Close) */}
        <div className="absolute top-3.5 right-3.5 flex items-center gap-2 z-10">
          <button
            onClick={handleShare}
            id="btn-share-biz"
            className="p-2 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white backdrop-blur-md transition-all shadow-md"
            title="Compartir enlace"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            id="btn-close-biz-detail"
            className="p-2 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white backdrop-blur-md transition-all shadow-md"
            title="Cerrar detalles"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Business Title in Header */}
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-600 text-white backdrop-blur-md tracking-wide uppercase">
              {business.category}
            </span>
            {business.transferVerified && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-600/90 text-white shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                DevParadise Verificado
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm font-display leading-tight">
            {business.name}
          </h2>
        </div>
      </div>

      {/* Scrollable details body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
        {/* Real-time Transfer status box (Gran Diferencial Cubano) */}
        <div className={`p-4 rounded-2xl border transition-all ${
          business.transferActiveNow 
            ? 'bg-emerald-50/90 border-emerald-300 shadow-sm shadow-emerald-500/10' 
            : 'bg-amber-50/90 border-amber-300 shadow-sm shadow-amber-500/10'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                business.transferActiveNow ? 'bg-emerald-500 animate-beacon' : 'bg-amber-500'
              }`} />
              <div>
                <p className={`text-sm font-extrabold font-display leading-tight ${
                  business.transferActiveNow ? 'text-emerald-950' : 'text-amber-950'
                }`}>
                  {business.transferActiveNow 
                    ? '🟢 Transferencia disponible AHORA' 
                    : '🟡 Transferencia inactiva temporalmente'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Actualizado: <strong className="text-slate-700 font-semibold">{business.lastStatusUpdate}</strong>
                </p>
              </div>
            </div>

            {/* Quick toggle for owners or admin */}
            <button
              onClick={() => onToggleTransferActive(business.id)}
              className="text-[11px] font-bold text-slate-600 hover:text-slate-950 underline underline-offset-2 flex-shrink-0"
            >
              Cambiar estado
            </button>
          </div>

          <p className="text-xs text-slate-600 mt-2.5 border-t border-slate-200/80 pt-2.5 leading-relaxed">
            {business.transferActiveNow 
              ? 'Este comercio tiene confirmación de recepción de pagos digitales (Transfermóvil / EnZona) en las últimas horas.'
              : 'El comercio ha reportado problemas temporales de conexión bancaria, fluido eléctrico o solo está operando en efectivo.'}
          </p>
        </div>

        {/* Distance indicator if available */}
        {business.distanceMeters !== undefined && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200/80 text-blue-950 text-xs sm:text-sm shadow-sm">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>A solo <strong>{formatDistance(business.distanceMeters)}</strong> de tu posición</span>
            </div>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline"
            >
              <span>GPS</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Address and location details card */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3 text-xs sm:text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-slate-900">{business.address}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {business.neighborhood ? `${business.neighborhood}, ` : ''}{business.municipality}, {business.province}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
            <Clock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-slate-800 font-semibold">{business.hours}</p>
              <p className="text-xs text-slate-400">Horario habitual de atención</p>
            </div>
          </div>

          {business.phone && (
            <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
              <Phone className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <a href={`tel:${business.phone}`} className="text-blue-600 font-semibold hover:underline">
                  {business.phone}
                </a>
                <p className="text-xs text-slate-400">Línea fija directa</p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {business.description && (
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 font-display">
              Descripción del establecimiento
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {business.description}
            </p>
          </div>
        )}

        {/* Accepted Payment Methods Breakdown */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-3 font-display">
            Pasarelas de Pago Admitidas
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              business.transferDetails.transfermovil 
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold' 
                : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
            }`}>
              <CreditCard className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Transfermóvil</span>
              {business.transferDetails.transfermovil && <Check className="w-3.5 h-3.5 ml-auto text-emerald-700 stroke-[3]" />}
            </div>

            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              business.transferDetails.enzona 
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold' 
                : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
            }`}>
              <CreditCard className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>EnZona</span>
              {business.transferDetails.enzona && <Check className="w-3.5 h-3.5 ml-auto text-emerald-700 stroke-[3]" />}
            </div>

            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              business.transferDetails.qrPayment 
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold' 
                : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
            }`}>
              <QrCode className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>Código QR</span>
              {business.transferDetails.qrPayment && <Check className="w-3.5 h-3.5 ml-auto text-emerald-700 stroke-[3]" />}
            </div>

            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              business.transferDetails.cash 
                ? 'bg-slate-50 border-slate-200 text-slate-800 font-semibold' 
                : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
            }`}>
              <Banknote className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span>Efectivo CUP</span>
              {business.transferDetails.cash && <Check className="w-3.5 h-3.5 ml-auto text-slate-500 stroke-[3]" />}
            </div>
          </div>
        </div>

        {/* Community Verification Widget */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center space-y-3">
          <p className="text-xs font-bold text-slate-800 font-display">
            ¿La información de transferencia sigue activa hoy?
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => handleVoteAction(true)}
              disabled={votedType !== null}
              id="btn-vote-correct"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                votedType === 'yes'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Sí funciona ({business.confirmationsCount + (votedType === 'yes' ? 1 : 0)})</span>
            </button>

            <button
              onClick={() => handleVoteAction(false)}
              disabled={votedType !== null}
              id="btn-vote-incorrect"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                votedType === 'no'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>No aceptan ({business.reportsCount + (votedType === 'no' ? 1 : 0)})</span>
            </button>
          </div>
          {votedType && (
            <p className="text-[11px] text-emerald-700 font-semibold animate-in fade-in">
              ✓ ¡Gracias por ayudar a la comunidad a mantener los datos al día!
            </p>
          )}
        </div>

        {/* Report wrong data form */}
        <div className="pb-4 text-center">
          {!showReportForm ? (
            <button
              onClick={() => setShowReportForm(true)}
              className="text-xs text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1.5 mx-auto transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Reportar datos desactualizados o negocio cerrado
            </button>
          ) : (
            <form onSubmit={handleSendReport} className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3 text-left">
              <p className="text-xs font-bold text-rose-950 font-display">Reportar información a DevParadise</p>
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Indica qué cambió (ej. cambiaron de teléfono, no aceptan transferencias, se mudaron...)"
                className="w-full text-xs p-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={2}
                required
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-white rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-sm"
                >
                  {reportSent ? '¡Reporte enviado!' : 'Enviar reporte'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="p-4 bg-white border-t border-slate-200/90 flex items-center gap-3 shadow-lg">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          id="btn-biz-whatsapp"
          className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-700/20 transition-all active:scale-[0.99]"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Consultar por WhatsApp</span>
        </a>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          id="btn-biz-directions"
          className="flex items-center justify-center p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all hover:scale-105 shadow-sm"
          title="Abrir mapa de indicaciones"
        >
          <Navigation className="w-5 h-5 text-blue-600" />
        </a>
      </div>
    </aside>
  );
}
