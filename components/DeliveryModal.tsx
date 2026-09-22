'use client';

import React from 'react';
import ModalShell from '@/components/ModalShell';
import {
  X,
  Package,
  MapPin,
  LocateFixed,
  Banknote,
  Loader2,
  Check,
  History,
  Plus,
  User,
  ArrowLeft,
  Bell,
  Star,
  MessageSquare
} from 'lucide-react';
import {
  PACKAGE_TYPES,
  PACKAGE_TYPE_LABELS,
  STATUS_LABELS,
  REVIEW_COMMENT_MAX,
  type DeliveryDTO,
  type DeliveryReviewDTO,
  type PackageType
} from '@/lib/delivery-client';
import type { UseDeliveriesState } from '@/lib/hooks/useDeliveries';

interface DeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  user: { name: string } | null;
  userLocation: { lat: number; lng: number } | null;
  deliveries: UseDeliveriesState;
  pickFromUserLocation: () => void;
}

function cup(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(n)} CUP`;
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg border text-xs font-bold transition-colors ${
        on
          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
          : 'bg-white border-border-subtle text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span>{label}</span>
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-emerald-brand' : 'bg-slate-300'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

function PointField({
  title,
  point,
  onPick,
  onGps,
  showGps
}: {
  title: string;
  point: { address: string } | null;
  onPick: () => void;
  onGps?: () => void;
  showGps?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{title}</span>
      </div>
      <button
        type="button"
        onClick={onPick}
        className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs flex items-center gap-2.5 transition-colors ${
          point
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-white border-border-subtle text-slate-600 hover:bg-slate-50'
        }`}
      >
        <MapPin className="w-4 h-4 shrink-0 text-emerald-brand" />
        <span className="flex-1 leading-snug">
          {point ? point.address : 'Elegir en el mapa'}
        </span>
        {point && <Check className="w-4 h-4 text-emerald-brand shrink-0" />}
      </button>
      {showGps && (
        <button
          type="button"
          onClick={onGps}
          className="w-full text-left px-3 py-2 rounded-lg border border-border-subtle text-[11px] font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-2 transition-colors"
        >
          <LocateFixed className="w-3.5 h-3.5 text-cerulean" />
          Usar mi ubicación GPS
        </button>
      )}
    </div>
  );
}

function DeliveryStatusBadge({ d }: { d: DeliveryDTO }) {
  const color =
    d.status === 'DELIVERED'
      ? 'bg-emerald-100 text-emerald-700'
      : d.status === 'CANCELLED' || d.status === 'EXPIRED'
        ? 'bg-slate-100 text-slate-500'
        : 'bg-cerulean/10 text-cerulean';
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${color}`}>
      {STATUS_LABELS[d.status]}
    </span>
  );
}

export default function DeliveryModal({
  isOpen,
  onClose,
  onOpenAuth,
  user,
  userLocation,
  deliveries,
  pickFromUserLocation
}: DeliveryModalProps) {
  React.useEffect(() => {
    if (!isOpen) {
      deliveries.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const { view } = deliveries;
  const notLoggedIn = !user;

  // Vista "pick": overlay ligero que NO bloquea el mapa (clic directo sobre él).
  if (view === 'pick') {
    return (
      <div className="fixed inset-0 z-[40] pointer-events-none">
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[calc(100vw-24px)] max-w-sm px-4 pointer-events-auto">
          <div className="bg-navy/95 text-white backdrop-blur-md px-4 py-2.5 rounded-lg shadow-level-3 border border-navy-hover flex items-center gap-2 text-xs sm:text-sm font-medium animate-pulse">
            <span>📍 Haz clic en el mapa para marcar el {deliveries.picking === 'pickup' ? 'origen (A)' : 'destino (B)'}</span>
          </div>
        </div>
        <div className="absolute bottom-6 inset-x-0 flex justify-center px-4 pointer-events-auto">
          <div className="bg-white rounded-xl shadow-level-4 border border-border-subtle/90 px-4 py-3 flex items-center gap-3 max-w-sm w-full">
            <div className="w-9 h-9 rounded-full bg-cerulean/10 border border-cerulean/30 text-cerulean flex items-center justify-center flex-shrink-0">
              {deliveries.picking === 'pickup' ? 'A' : 'B'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-slate-800">
                Marcar {deliveries.picking === 'pickup' ? 'origen' : 'destino'}
              </p>
              <p className="text-[11px] text-slate-500">Se tomará el punto exacto donde hagas clic sobre el mapa.</p>
            </div>
            <button
              onClick={deliveries.cancelPicking}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="delivery-modal-title"
      describedBy="delivery-modal-subtitle"
      overlayClassName="z-[60] p-3 sm:p-5"
      panelClassName="bg-white rounded-xl shadow-level-4 border border-border-subtle/90 w-full max-w-lg max-h-[94dvh] animate-in fade-in zoom-in-95 duration-200"
    >
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 bg-navy text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-brand/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner flex-shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="delivery-modal-title" className="text-base font-extrabold text-white font-display">
                {view === 'success' ? 'Envío solicitado' : view === 'history' ? 'Mis deliveries' : 'Solicitar delivery'}
              </h2>
              <p id="delivery-modal-subtitle" className="text-[11px] text-slate-400">
                {view === 'history' ? `${deliveries.history.length} deliveries` : 'Delivery en Cuba'}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {notLoggedIn ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-brand flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Inicia sesión para pedir un envío</p>
                <p className="text-xs text-slate-500 mt-1">Usa tu teléfono y PIN para solicitar el servicio de mensajería.</p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="px-4 py-2.5 rounded-lg bg-emerald-brand hover:bg-emerald-700 text-white text-xs font-extrabold shadow-level-2"
              >
                Entrar con teléfono + PIN
              </button>
            </div>
          ) : view === 'success' && deliveries.lastDelivery ? (
            <SuccessView d={deliveries.lastDelivery} onAnother={() => deliveries.reset()} onHistory={deliveries.openHistory} />
          ) : view === 'history' ? (
            <HistoryView
              history={deliveries.history}
              isLoading={deliveries.isOpeningHistory}
              onNew={() => deliveries.openForm()}
              reviewsByDelivery={deliveries.reviewsByDelivery}
              onSubmitReview={deliveries.submitReview}
              isSubmittingReview={deliveries.isSubmittingReview}
              onLoadMore={deliveries.loadMoreHistory}
              hasMore={deliveries.historyCursor !== null}
              isLoadingMore={deliveries.isLoadingMoreHistory}
            />
          ) : (
            <>
              {/* Paquete */}
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Qué envío</span>
                <div className="flex flex-wrap gap-1.5">
                  {PACKAGE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => deliveries.setPackageType(t as PackageType)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                        deliveries.packageType === t
                          ? 'bg-emerald-brand text-white border-emerald-brand shadow-level-1'
                          : 'bg-white text-slate-600 border-border-subtle hover:bg-slate-50'
                      }`}
                    >
                      {PACKAGE_TYPE_LABELS[t as PackageType]}
                    </button>
                  ))}
                </div>
                <input
                  value={deliveries.packageNote}
                  onChange={(e) => deliveries.setPackageNote(e.target.value)}
                  maxLength={300}
                  placeholder="Nota del paquete (opcional) — piso, código, referencia..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-brand/40 placeholder:text-slate-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Toggle on={deliveries.fragile} onToggle={() => deliveries.setFragile(!deliveries.fragile)} label="📦 Frágil" />
                  <Toggle on={deliveries.payableOnDelivery} onToggle={() => deliveries.setPayableOnDelivery(!deliveries.payableOnDelivery)} label="💳 Pago al recibir" />
                </div>
              </div>

              {/* Origen y destino */}
              <div className="space-y-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Ruta</span>
                <PointField
                  title="Origen"
                  point={deliveries.pickup}
                  onPick={() => deliveries.startPicking('pickup')}
                  onGps={pickFromUserLocation}
                  showGps={userLocation !== null}
                />
                <PointField title="Destino" point={deliveries.dropoff} onPick={() => deliveries.startPicking('dropoff')} />
              </div>

              {/* Estimación */}
              {deliveries.isEstimating ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Calculando precio estimado...
                </div>
              ) : deliveries.estimate ? (
                <div className="rounded-lg bg-slate-50 border border-border-subtle p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Precio aproximado</span>
                    <span className="text-lg font-extrabold text-emerald-brand font-display">
                      {cup(deliveries.estimate.totalFareCup)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {deliveries.estimate.distanceKm} km
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bell className="w-3 h-3" /> {deliveries.estimate.durationMin} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Banknote className="w-3 h-3" /> {cup(deliveries.estimate.breakdown.baseCup)} + km extra
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">Marca origen y destino para ver el precio estimado.</p>
              )}

              <button
                type="button"
                onClick={deliveries.submit}
                disabled={deliveries.isSubmitting || !deliveries.pickup || !deliveries.dropoff}
                className="w-full py-3 rounded-lg bg-emerald-brand hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-extrabold font-display shadow-level-2 flex items-center justify-center gap-2 transition-colors"
              >
                {deliveries.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creando solicitud...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" /> Solicitar envío
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer with history link */}
        {!notLoggedIn && view === 'form' && (
          <div className="p-3 bg-slate-50 border-t border-border-subtle/90 flex items-center justify-center">
            <button
              onClick={deliveries.openHistory}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-brand transition-colors"
            >
              <History className="w-3.5 h-3.5" /> Ver mis envíos
            </button>
          </div>
        )}
    </ModalShell>
  );
}

function SuccessView({ d, onAnother, onHistory }: { d: DeliveryDTO; onAnother: () => void; onHistory: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-brand flex items-center justify-center border-4 border-emerald-50">
        <Check className="w-7 h-7" />
      </div>
      <div>
        <p className="font-extrabold text-slate-800 font-display">Solicitud creada</p>
        <p className="text-xs text-slate-500 mt-0.5">Un mensajero la tomará en breve. Está publicada en el tablón.</p>
      </div>
      <div className="w-full rounded-lg bg-slate-50 border border-border-subtle p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Código</span>
          <span className="font-mono font-extrabold text-cerulean">{d.code}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Estado</span>
          <DeliveryStatusBadge d={d} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Distancia</span>
          <span className="font-bold">{d.distanceKm} km · {d.durationMin} min</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-border-subtle pt-2">
          <span className="text-slate-500">Tarifa</span>
          <span className="font-extrabold text-emerald-brand font-display">{cup(d.totalFareCup)}</span>
        </div>
      </div>
      <div className="flex gap-2 w-full">
        <button
          onClick={onAnother}
          className="flex-1 py-2.5 rounded-lg bg-emerald-brand hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors"
        >
          Pedir otro envío
        </button>
        <button
          onClick={onHistory}
          className="flex-1 py-2.5 rounded-lg border border-border-subtle text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <History className="w-3.5 h-3.5" /> Historial
        </button>
      </div>
    </div>
  );
}

function HistoryView({
  history,
  isLoading,
  onNew,
  reviewsByDelivery,
  onSubmitReview,
  isSubmittingReview,
  onLoadMore,
  hasMore,
  isLoadingMore
}: {
  history: DeliveryDTO[];
  isLoading: boolean;
  onNew: () => void;
  reviewsByDelivery: Record<string, DeliveryReviewDTO>;
  onSubmitReview: (deliveryId: string, rating: number, comment: string) => Promise<boolean>;
  isSubmittingReview: boolean;
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  isLoadingMore: boolean;
}) {
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState(0);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [comment, setComment] = React.useState('');

  const handleSubmit = async (deliveryId: string) => {
    if (rating < 1 || rating > 5) return;
    const ok = await onSubmitReview(deliveryId, rating, comment);
    if (ok) {
      setReviewingId(null);
      setRating(0);
      setComment('');
    }
  };

  const startReview = (deliveryId: string) => {
    setReviewingId(deliveryId);
    setRating(0);
    setComment('');
  };

  return (
    <div className="space-y-2">
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
        </div>
      )}
      {!isLoading && history.length === 0 && (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-600">Aún no has solicitado deliveries</p>
          <p className="text-xs text-slate-400">Solicita tu primer delivery desde un negocio cercano.</p>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-brand hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors"
          >
            Solicitar mi primer delivery
          </button>
        </div>
      )}
      {history.map((d) => {
        const existingReview = reviewsByDelivery[d.id];
        const canReview = d.status === 'DELIVERED' && !existingReview && reviewingId !== d.id;
        const isReviewing = reviewingId === d.id;

        return (
          <div key={d.id} className="rounded-lg border border-border-subtle p-3 space-y-1.5 bg-white">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-extrabold text-cerulean">{d.code}</span>
              <DeliveryStatusBadge d={d} />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <MapPin className="w-3 h-3 text-emerald-brand shrink-0" />
              <span className="truncate">{d.pickup?.address ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate">{d.dropoff?.address ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-border-subtle">
              <span>{d.distanceKm ?? '—'} km · {d.durationMin ?? '—'} min</span>
              <span className="font-extrabold text-emerald-brand">{cup(d.totalFareCup)}</span>
            </div>
            {d.messenger && (
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-brand text-[9px] font-extrabold flex items-center justify-center">
                  🛵
                </span>
                {d.messenger.name}
              </div>
            )}

            {/* Review existente */}
            {existingReview && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-2 space-y-1">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i < existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                    />
                  ))}
                  <span className="text-[10px] text-slate-500 ml-1">{existingReview.rating}/5</span>
                </div>
                {existingReview.comment && (
                  <p className="text-[11px] text-slate-600">{existingReview.comment}</p>
                )}
              </div>
            )}

            {/* Botón valorar */}
            {canReview && (
              <button
                onClick={() => startReview(d.id)}
                className="w-full py-1.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-bold hover:bg-amber-100 transition-colors inline-flex items-center justify-center gap-1"
              >
                <Star className="w-3 h-3" /> Valorar mensajero
              </button>
            )}

            {/* Formulario inline de review */}
            {isReviewing && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 space-y-2">
                <div className="flex items-center gap-0.5" role="group" aria-label="Puntuación">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      // Sin nombre accesible eran cinco botones idénticos: un
                      // lector de pantalla no podía distinguirlos y no había
                      // forma de saber cuál estaba elegido.
                      aria-label={i === 0 ? '1 estrella' : `${i + 1} estrellas`}
                      aria-pressed={rating === i + 1}
                      onClick={() => setRating(i + 1)}
                      onMouseEnter={() => setHoverRating(i + 1)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="flex h-11 w-9 items-center justify-center rounded p-0"
                    >
                      <Star
                        aria-hidden="true"
                        className={`w-5 h-5 transition-colors ${
                          i < (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  {rating > 0 && <span className="text-[11px] text-slate-500 ml-1">{rating}/5</span>}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={REVIEW_COMMENT_MAX}
                  rows={2}
                  placeholder="Comentario opcional..."
                  className="w-full px-2 py-1.5 rounded border border-amber-200 text-[11px] text-slate-700 outline-none focus:ring-1 focus:ring-amber-300 resize-none placeholder:text-slate-400"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleSubmit(d.id)}
                    disabled={rating < 1 || isSubmittingReview}
                    className="flex-1 py-1.5 rounded bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1"
                  >
                    {isSubmittingReview ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Enviar
                  </button>
                  <button
                    onClick={() => setReviewingId(null)}
                    className="px-3 py-1.5 rounded border border-slate-200 text-slate-500 text-[11px] font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Cargar más */}
      {hasMore && (
        <button
          onClick={() => onLoadMore()}
          disabled={isLoadingMore}
          className="w-full py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          {isLoadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {isLoadingMore ? 'Cargando...' : 'Cargar más'}
        </button>
      )}

      <button
        onClick={onNew}
        className="w-full py-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-brand text-xs font-extrabold hover:bg-emerald-100 transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Nuevo envío
      </button>
    </div>
  );
}