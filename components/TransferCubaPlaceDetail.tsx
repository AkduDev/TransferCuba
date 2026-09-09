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
  Check, 
  AlertTriangle, 
  Share2, 
  ThumbsUp, 
  ThumbsDown, 
  QrCode, 
  CreditCard, 
  ExternalLink,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Business } from '@/lib/cuba-data';

interface TransferCubaPlaceDetailProps {
  business: Business;
  onClose: () => void;
  onVote: (bizId: string, isConfirm: boolean) => void;
  onToggleTransferActive: (bizId: string) => void;
  onReport: (bizId: string, reason: string) => void;
  onCalculateRoute: (biz: Business) => void;
  hasUserLocation: boolean;
}

export default function TransferCubaPlaceDetail({
  business,
  onClose,
  onVote,
  onToggleTransferActive,
  onReport,
  onCalculateRoute,
  hasUserLocation
}: TransferCubaPlaceDetailProps) {
  const [copied, setCopied] = useState(false);
  const [voted, setVoted] = useState<'confirm' | 'report' | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const isReported = business.reportsCount > 0;
  const isVerified = business.transferVerified && !isReported;
  const isPending = !isVerified && !isReported;

  const handleCopyShare = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      navigator.clipboard.writeText(`${business.name} acepta transferencia en Cuba: ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleVoteAction = (isConfirm: boolean) => {
    if (voted) return;
    setVoted(isConfirm ? 'confirm' : 'report');
    onVote(business.id, isConfirm);
  };

  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    onReport(business.id, reportReason);
    setShowReportModal(false);
    setReportReason('');
  };

  const cleanPhone = business.phone ? business.phone.replace(/\D/g, '') : '';
  const cleanWhatsapp = business.whatsapp ? business.whatsapp.replace(/\D/g, '') : '';

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden text-slate-800">
      {/* Top Header Bar */}
      <div className="p-3 bg-slate-900 text-white flex items-center justify-between gap-2 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Volver a la lista</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyShare}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Compartir negocio"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Photo Header */}
        <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden bg-slate-100 shadow-sm border border-slate-200">
          <Image
            src={business.photos[0] || 'https://picsum.photos/seed/cuba-biz/600/400'}
            alt={business.name}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <span className="text-2xl mb-1 block">{business.categoryIcon}</span>
            <h2 className="text-lg sm:text-xl font-black leading-tight drop-shadow-md">
              {business.name}
            </h2>
            <p className="text-xs text-slate-200 flex items-center gap-1 mt-0.5 font-medium">
              <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span>{business.address}, {business.municipality}</span>
            </p>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
          isVerified 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : isReported
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-center gap-2.5">
            {isVerified && <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
            {isPending && <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />}
            {isReported && <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />}
            <div>
              <p className="text-xs font-bold">
                {isVerified && '✓ Transferencia Verificada por TransferCuba'}
                {isPending && '⏳ Pendiente de Verificación por Moderación'}
                {isReported && '⚠️ Información Posiblemente Desactualizada'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {business.lastStatusUpdate} · {business.confirmationsCount} confirmaciones
              </p>
            </div>
          </div>

          <button
            onClick={() => onToggleTransferActive(business.id)}
            className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1"
            title="Cambiar estado en vivo"
          >
            {business.transferActiveNow ? (
              <ToggleRight className="w-6 h-6 text-emerald-600" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-slate-400" />
            )}
          </button>
        </div>

        {/* Primary Action Buttons (WhatsApp, Ruta OSRM, Llamar) */}
        <div className="grid grid-cols-2 gap-2">
          {business.whatsapp ? (
            <a
              href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`Hola, vi ${business.name} en TransferCuba y quisiera comprar por transferencia.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          ) : (
            <button disabled className="px-3 py-2.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span>Sin WhatsApp</span>
            </button>
          )}

          <button
            onClick={() => onCalculateRoute(business)}
            className="px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Navigation className="w-4 h-4" />
            <span>Cómo llegar (Ruta)</span>
          </button>
        </div>

        {/* Payment Gateways Breakdown */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
            <span>Métodos de Pago Admitidos</span>
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-2 rounded-lg border flex items-center gap-2 ${
              business.transferDetails.transfermovil 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-bold' 
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Transfermóvil</span>
            </div>

            <div className={`p-2 rounded-lg border flex items-center gap-2 ${
              business.transferDetails.enzona 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-bold' 
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>EnZona</span>
            </div>

            <div className={`p-2 rounded-lg border flex items-center gap-2 ${
              business.transferDetails.qrPayment 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-bold' 
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}>
              <QrCode className="w-3.5 h-3.5 text-slate-700" />
              <span>Código QR</span>
            </div>

            <div className={`p-2 rounded-lg border flex items-center gap-2 ${
              business.transferDetails.cash 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-bold' 
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}>
              <span>💵 Efectivo</span>
            </div>
          </div>
        </div>

        {/* Location & Schedule info */}
        <div className="space-y-2 text-xs text-slate-700">
          <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200">
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">Horario habitual</p>
              <p className="text-slate-600">{business.hours}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">Dirección y coordenadas</p>
              <p className="text-slate-600">{business.address}</p>
              {business.neighborhood && (
                <p className="text-slate-500 text-[11px]">Reparto: {business.neighborhood}</p>
              )}
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                GPS: {business.lat.toFixed(5)}, {business.lng.toFixed(5)}
              </p>
            </div>
          </div>
        </div>

        {/* Community Validation & Voting */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">¿Sigue aceptando transferencia?</span>
            <span className="text-[10px] text-slate-500">Valida la comunidad</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleVoteAction(true)}
              disabled={voted !== null}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                voted === 'confirm'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Sí, acepta ({business.confirmationsCount})</span>
            </button>

            <button
              onClick={() => handleVoteAction(false)}
              disabled={voted !== null}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                voted === 'report'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white hover:bg-rose-50 text-rose-700 border border-slate-200'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>No acepta ({business.reportsCount})</span>
            </button>
          </div>

          <div className="pt-1 text-center">
            <button
              onClick={() => setShowReportModal(true)}
              className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors"
            >
              Reportar datos incorrectos o cierre
            </button>
          </div>
        </div>
      </div>

      {/* Report Modal Dialog */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Reportar negocio</h4>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <form onSubmit={handleSendReport} className="space-y-3">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Indica qué cambió: ¿ya no acepta transferencia?, ¿cerró?, ¿número cambiado?"
                rows={3}
                required
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Enviar reporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
