'use client';

import React from 'react';
import { X, Bike, Loader2, MapPin, Package, Banknote, RefreshCw, User, CheckCircle2 } from 'lucide-react';
import {
  PACKAGE_TYPE_LABELS,
  STATUS_LABELS,
  type AvailableDeliveryDTO,
  type DeliveryDTO,
  type DeliveryStatus,
  type PackageType
} from '@/lib/delivery-client';
import type { UseDeliveriesState } from '@/lib/hooks/useDeliveries';

interface GoogleMapsMessengerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  user: { id: string; role?: string; name: string } | null;
  deliveries: UseDeliveriesState;
}

const STEP_FLOW: { status: DeliveryStatus; label: string }[] = [
  { status: 'ACCEPTED', label: 'En camino al origen' },
  { status: 'PICKED_UP', label: 'Paquete recogido' },
  { status: 'IN_TRANSIT', label: 'En camino al destino' },
  { status: 'DELIVERED', label: 'Entregado' }
];

function cup(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(n)} CUP`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)} h`;
}

function waypointRow({ icon, address, note }: { icon: string; address: string | null | undefined; note?: string | null }) {
  return (
    <div className="flex items-start gap-2 text-[11px] text-slate-600">
      <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
      <span className="flex-1 leading-snug break-words">
        {address ?? '—'}
        {note ? <span className="text-slate-400 block">({note})</span> : null}
      </span>
    </div>
  );
}

function AvailableCard({
  d,
  isActing,
  onAccept
}: {
  d: AvailableDeliveryDTO;
  isActing: boolean;
  onAccept: () => void;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white p-3 space-y-2 shadow-level-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-extrabold text-cerulean">{d.code}</span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold">
            {PACKAGE_TYPE_LABELS[d.packageType as PackageType] ?? d.packageType}
          </span>
          {d.fragile && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">📦 Frágil</span>
          )}
        </div>
        <span className="text-[10px] text-slate-400">{timeAgo(d.requestedAt)}</span>
      </div>
      {waypointRow({ icon: 'A', address: d.pickup?.address, note: d.pickup?.note })}
      {d.packageNote && (
        <p className="text-[11px] text-slate-400 italic leading-snug">“{d.packageNote}”</p>
      )}
      <div className="flex items-center justify-between border-t border-border-subtle pt-2">
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-400" /> {d.distanceKm} km
          </span>
          <span>{d.durationMin} min</span>
          {d.payableOnDelivery && (
            <span className="inline-flex items-center gap-0.5 text-emerald-brand font-bold">
              <Banknote className="w-3 h-3" /> al recibir
            </span>
          )}
        </div>
        <span className="font-extrabold text-emerald-brand font-display text-sm">{cup(d.totalFareCup)}</span>
      </div>
      <button
        onClick={onAccept}
        disabled={isActing}
        className="w-full py-2 rounded-lg bg-emerald-brand hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold transition-colors"
      >
        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Aceptar carrera'}
      </button>
    </div>
  );
}

function ActiveCard({ d, isActing, onStep }: { d: DeliveryDTO; isActing: boolean; onStep: (a: 'pick_up' | 'in_transit' | 'deliver') => void }) {
  const currentIdx = STEP_FLOW.findIndex((s) => s.status === d.status);
  const stepCursor = currentIdx >= 0 ? currentIdx : -1;

  const nextAction =
    d.status === 'ACCEPTED'
      ? { label: 'Confirmar recogida del paquete', action: 'pick_up' as const }
      : d.status === 'PICKED_UP'
        ? { label: 'Iniciar viaje al destino', action: 'in_transit' as const }
        : d.status === 'IN_TRANSIT'
          ? { label: 'Marcar como entregado', action: 'deliver' as const }
          : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-extrabold text-cerulean">{d.code}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              d.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : 'bg-cerulean/10 text-cerulean'
            }`}>
              {STATUS_LABELS[d.status]}
            </span>
          </div>
          <span className="font-extrabold text-emerald-brand font-display text-sm">{cup(d.totalFareCup)}</span>
        </div>
        {d.requester && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <User className="w-3.5 h-3.5 text-cerulean" /> Cliente: {d.requester.name}
          </div>
        )}
        <div className="grid gap-1.5 pt-1">
          {waypointRow({ icon: '🟢', address: d.pickup?.address, note: d.pickup?.note })}
          {waypointRow({ icon: '🔴', address: d.dropoff?.address, note: d.dropoff?.note })}
        </div>
        {d.packageNote && (
          <p className="text-[11px] text-slate-500 italic leading-snug pt-1">“{d.packageNote}”</p>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border-subtle p-3 bg-white">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Avance de la carrera</p>
        <div className="relative pl-5">
          {STEP_FLOW.map((s, i) => {
            const done = i <= stepCursor && d.status !== 'CANCELLED' && d.status !== 'EXPIRED';
            return (
              <div key={s.status} className="relative pb-3 last:pb-0">
                {i < STEP_FLOW.length - 1 && (
                  <span className={`absolute left-[5px] top-4 bottom-0 w-[2px] ${done ? 'bg-emerald-brand' : 'bg-slate-200'}`} />
                )}
                <span className={`absolute left-0 top-0 w-[11px] h-[11px] rounded-full border-2 ${done ? 'bg-emerald-brand border-emerald-brand' : 'bg-white border-slate-300'}`} />
                <p className={`text-xs font-bold ${done ? 'text-emerald-700' : d.status === s.status ? 'text-cerulean' : 'text-slate-400'}`}>
                  {s.label}
                  {d.status === s.status && <span className="ml-1 text-[10px] text-cerulean animate-pulse">●</span>}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {nextAction && (
        <button
          onClick={() => onStep(nextAction.action)}
          disabled={isActing}
          className="w-full py-2.5 rounded-lg bg-emerald-brand hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold transition-colors inline-flex items-center justify-center gap-2"
        >
          {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
          {nextAction.label}
        </button>
      )}
      {d.status === 'DELIVERED' && (
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-brand py-1">
          <CheckCircle2 className="w-4 h-4" /> Carrera completada
        </div>
      )}
    </div>
  );
}

export default function GoogleMapsMessengerModal({ isOpen, onClose, onOpenAuth, user, deliveries }: GoogleMapsMessengerModalProps) {
  const isMessenger = user?.role === 'MESSENGER';

  React.useEffect(() => {
    if (isOpen && isMessenger) {
      void deliveries.refreshMessenger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-level-4 border border-border-subtle/90 w-full max-w-lg max-h-[94dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-4 sm:px-5 py-4 bg-navy text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cerulean/20 border border-cerulean/40 text-cerulean-light flex items-center justify-center shadow-inner flex-shrink-0">
              <Bike className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white font-display">Mensajería</h2>
              <p className="text-[11px] text-slate-400">Tablón de carreras para mensajeros</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isMessenger ? (
          <div className="flex-1 flex flex-col items-center gap-4 py-10 px-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-cerulean/10 border border-cerulean/20 text-cerulean flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-800">El tablón es para mensajeros</p>
              <p className="text-xs text-slate-500 mt-1">Tu cuenta debe tener el rol de mensajero para ver y aceptar carreras.</p>
            </div>
            <button
              onClick={onOpenAuth}
              className="px-4 py-2.5 rounded-lg border border-border-subtle text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cambiar de cuenta
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-50 border-b border-border-subtle p-1.5 flex-shrink-0">
              <button
                onClick={() => deliveries.setMessengerTab('available')}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-colors ${
                  deliveries.messengerTab === 'available' ? 'bg-white text-cerulean shadow-level-1' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Carreras {!deliveries.isFetchingAvailable && deliveries.messengerAvailable.length > 0 && `(${deliveries.messengerAvailable.length})`}
              </button>
              <button
                onClick={() => deliveries.setMessengerTab('active')}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-colors ${
                  deliveries.messengerTab === 'active' ? 'bg-white text-cerulean shadow-level-1' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Mi carrera {deliveries.messengerActive ? '●' : ''}
              </button>
              <button
                onClick={() => void deliveries.refreshMessenger()}
                className="p-2 rounded-lg text-slate-400 hover:text-cerulean hover:bg-slate-100 transition-colors"
                title="Actualizar"
              >
                <RefreshCw className={`w-4 h-4 ${deliveries.isFetchingAvailable ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {deliveries.messengerTab === 'available' ? (
                deliveries.isFetchingAvailable && deliveries.messengerAvailable.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Buscando carreras...
                  </div>
                ) : deliveries.messengerAvailable.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-bold text-slate-600">No hay carreras pendientes</p>
                    <p className="text-xs text-slate-400 mt-1">Nuevas solicitudes aparecerán aquí al instante.</p>
                  </div>
                ) : (
                  deliveries.messengerAvailable.map((d) => (
                    <AvailableCard key={d.id} d={d} isActing={deliveries.isActing} onAccept={() => void deliveries.acceptAvailable(d.id)} />
                  ))
                )
              ) : deliveries.messengerActive ? (
                <ActiveCard d={deliveries.messengerActive} isActing={deliveries.isActing} onStep={(a) => void deliveries.messengerStep(a)} />
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-slate-600">No tienes una carrera activa</p>
                  <p className="text-xs text-slate-400 mt-1">Acepta una del tablón para empezar.</p>
                  <button
                    onClick={() => deliveries.setMessengerTab('available')}
                    className="mt-3 px-4 py-2 rounded-lg bg-emerald-brand hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors"
                  >
                    Ver carreras disponibles
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}