'use client';

import React from 'react';
import { X, Bike, Loader2, MapPin, Package, Banknote, RefreshCw, User, CheckCircle2, CreditCard, MessageCircle, Send, AlertCircle, ClipboardCheck, Clock, XCircle, CalendarClock, Wallet, TimerReset } from 'lucide-react';
import ModalShell from '@/components/ModalShell';
import {
  PACKAGE_TYPE_LABELS,
  STATUS_LABELS,
  type AvailableDeliveryDTO,
  type DeliveryDTO,
  type DeliveryStatus,
  type PackageType
} from '@/lib/delivery-client';
import type { UseDeliveriesState } from '@/lib/hooks/useDeliveries';
import { DIAS_AVISO_RENOVACION } from '@/lib/hooks/useMessengerApplication';
import type {
  MessengerApplicationInput,
  MessengerPaymentKind,
  MessengerPaymentMethod,
  MessengerPlatformConfig,
  UseMessengerApplicationState
} from '@/lib/hooks/useMessengerApplication';

interface GoogleMapsMessengerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  user: { id: string; role?: string; name: string } | null;
  deliveries: UseDeliveriesState;
  application: UseMessengerApplicationState;
}

const STEP_FLOW: { status: DeliveryStatus; label: string }[] = [
  { status: 'ACCEPTED', label: 'En camino al origen' },
  { status: 'PICKED_UP', label: 'Paquete recogido' },
  { status: 'IN_TRANSIT', label: 'En camino al destino' },
  { status: 'DELIVERED', label: 'Entregado' }
];

// Mismo lenguaje A/B que los marcadores del mapa (active-delivery-a/b-layer
// en MapLibreMap): A esmeralda = origen, B rosa = destino.
const WAYPOINT = {
  pickup: { letter: 'A', label: 'Origen', badge: 'bg-emerald-brand' },
  dropoff: { letter: 'B', label: 'Destino', badge: 'bg-rose-500' }
} as const;

const TAB_ORDER = ['available', 'active'] as const;
type MessengerTab = (typeof TAB_ORDER)[number];

function cup(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(n)} CUP`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)} h`;
}

function Waypoint({
  kind,
  address,
  note
}: {
  kind: keyof typeof WAYPOINT;
  address: string | null | undefined;
  note?: string | null;
}) {
  const point = WAYPOINT[kind];
  return (
    <div className="flex items-start gap-2 text-[11px] text-slate-600">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${point.badge} text-[9px] font-extrabold text-white`}
      >
        {point.letter}
      </span>
      <span className="flex-1 leading-snug break-words">
        <span className="sr-only">{point.label}: </span>
        {address ?? '—'}
        {note ? <span className="text-slate-500 block">({note})</span> : null}
      </span>
    </div>
  );
}

const METHOD_LABELS: Record<MessengerPaymentMethod, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo'
};

/** "quedan 3 días" / "vence hoy" — el plural y el caso cero se dicen bien. */
function diasRestantes(n: number): string {
  if (n <= 0) return 'vencida';
  if (n === 1) return 'queda 1 día';
  return `quedan ${n} días`;
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const VEHICLE_LABELS: Record<MessengerApplicationInput['vehicle'], string> = {
  pie: 'A pie',
  bicicleta: 'Bicicleta',
  moto: 'Moto',
  auto: 'Auto',
  otro: 'Otro'
};

function whatsappLink(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '#';
}

function ApplicationForm({
  platform,
  isSubmitting,
  kind,
  defaults,
  onSubmit
}: {
  platform: MessengerPlatformConfig;
  isSubmitting: boolean;
  /** Cambia solo el texto: el servidor decide si es alta o renovación. */
  kind: MessengerPaymentKind;
  defaults?: { vehicle?: MessengerApplicationInput['vehicle']; serviceAreas?: string[] };
  onSubmit: (input: MessengerApplicationInput) => Promise<boolean>;
}) {
  const [vehicle, setVehicle] = React.useState<MessengerApplicationInput['vehicle']>(defaults?.vehicle ?? 'moto');
  const [serviceAreas, setServiceAreas] = React.useState((defaults?.serviceAreas ?? []).join(', '));
  const [reference, setReference] = React.useState('');
  const [method, setMethod] = React.useState<MessengerPaymentMethod>('transferencia');

  const esRenovacion = kind === 'renovacion';
  const esEfectivo = method === 'efectivo';

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const areas = serviceAreas.split(/[,\n]/).map((area) => area.trim()).filter(Boolean);
      await onSubmit({ vehicle, serviceAreas: areas, reference, method });
    }} className="space-y-3">
      <div className="rounded-lg border border-border-subtle bg-slate-50 p-3 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
          <CreditCard className="w-4 h-4 text-cerulean shrink-0" aria-hidden="true" />
          {esRenovacion ? 'Renovar suscripción' : 'Requisitos de alta'}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
          <div className="rounded-md bg-white border border-border-subtle p-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Importe</p>
            <p className="font-black text-emerald-brand mt-0.5 text-sm">{cup(platform.messengerFeeCup)}</p>
          </div>
          <div className="rounded-md bg-white border border-border-subtle p-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Validez</p>
            <p className="font-black text-slate-800 mt-0.5 text-sm">{platform.messengerPeriodDays} días</p>
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Forma de pago</legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(METHOD_LABELS) as MessengerPaymentMethod[]).map((value) => {
              const activo = method === value;
              return (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-xs font-extrabold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cerulean ${
                    activo
                      ? 'border-emerald-brand bg-emerald-50 text-emerald-700'
                      : 'border-border-subtle bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="metodo-pago"
                    value={value}
                    checked={activo}
                    onChange={() => setMethod(value)}
                    className="sr-only"
                  />
                  {value === 'efectivo'
                    ? <Wallet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    : <CreditCard className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                  {METHOD_LABELS[value]}
                </label>
              );
            })}
          </div>
        </fieldset>

        {esEfectivo ? (
          <div className="rounded-md bg-white border border-border-subtle p-2 text-[11px] text-slate-600">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Dónde pagar</p>
            <p className="mt-0.5 leading-snug">
              Entrega el efectivo al administrador y avísale por WhatsApp para que confirme tu pago.
            </p>
            <a
              href={whatsappLink(platform.messengerWhatsapp)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-extrabold text-cerulean hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Avisar por WhatsApp
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div className="rounded-md bg-white border border-border-subtle p-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Transferir a</p>
              <p className="font-semibold mt-0.5 break-words">{platform.messengerPayCard || 'No configurado'}</p>
            </div>
            <div className="rounded-md bg-white border border-border-subtle p-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Comprobante</p>
              <a
                href={whatsappLink(platform.messengerWhatsapp)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 font-extrabold text-cerulean hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Enviar por WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-slate-600">Medio de transporte</span>
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value as MessengerApplicationInput['vehicle'])}
            className="w-full min-h-11 rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm font-semibold"
          >
            {(Object.keys(VEHICLE_LABELS) as MessengerApplicationInput['vehicle'][]).map((value) => (
              <option key={value} value={value}>{VEHICLE_LABELS[value]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-slate-600">
            {esEfectivo ? 'Nota del pago (opcional)' : 'Referencia de la transferencia'}
          </span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={esEfectivo ? 'Ej. entregado en mano el 12/09' : 'Ej. alta-mensajero-042'}
            className="w-full min-h-11 rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm font-semibold"
          />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-[11px] font-bold text-slate-600">Zonas de servicio</span>
        <textarea
          value={serviceAreas}
          onChange={(e) => setServiceAreas(e.target.value)}
          placeholder="La Habana, Playa, Centro Habana"
          rows={2}
          className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm font-semibold resize-none"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-brand px-4 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
        {isSubmitting
          ? 'Enviando...'
          : esRenovacion
            ? `Renovar por ${platform.messengerPeriodDays} días`
            : 'Enviar solicitud de alta'}
      </button>
    </form>
  );
}

function ApplicationPending({
  platform,
  payment,
  onRefresh
}: {
  platform: MessengerPlatformConfig;
  payment:
    | {
        amountCup: number;
        reference: string | null;
        createdAt: string;
        method?: MessengerPaymentMethod;
        kind?: MessengerPaymentKind;
        coversDays?: number | null;
      }
    | undefined;
  onRefresh: () => void;
}) {
  const esEfectivo = payment?.method === 'efectivo';
  const esRenovacion = payment?.kind === 'renovacion';

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-center">
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-saffron">
          <Clock className="w-4 h-4" aria-hidden="true" />
        </div>
        <p className="text-sm font-extrabold text-slate-800">
          {esRenovacion ? 'Renovación en revisión' : 'Solicitud en revisión'}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-600">
          {esEfectivo
            ? `Entrega ${cup(payment?.amountCup ?? platform.messengerFeeCup)} en efectivo al administrador y avísale por WhatsApp.`
            : `Realiza el pago de ${cup(payment?.amountCup ?? platform.messengerFeeCup)} y envía el comprobante por WhatsApp.`}
        </p>
        {payment?.coversDays ? (
          <p className="mt-1 text-[11px] font-bold text-slate-700">
            Al confirmarse suma {payment.coversDays} días.
          </p>
        ) : null}
      </div>
      <div className="rounded-lg border border-border-subtle bg-slate-50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Importe</p>
          <p className="font-black text-emerald-brand mt-0.5">{cup(payment?.amountCup)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Forma de pago</p>
          <p className="font-semibold text-slate-700 mt-0.5">
            {payment?.method ? METHOD_LABELS[payment.method] : '—'}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            {esEfectivo ? 'Nota' : 'Referencia'}
          </p>
          <p className="font-semibold text-slate-700 mt-0.5 break-words">{payment?.reference || 'Sin indicar'}</p>
        </div>
        <a
          href={whatsappLink(platform.messengerWhatsapp)}
          target="_blank"
          rel="noreferrer"
          className="sm:col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-white border border-cerulean/30 px-3 text-cerulean text-xs font-extrabold hover:bg-cerulean/5"
        >
          <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {esEfectivo ? 'Avisar por WhatsApp' : 'Enviar comprobante por WhatsApp'}
        </a>
      </div>
      <button onClick={onRefresh} className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-white px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50 transition-colors">
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Actualizar estado
      </button>
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
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
            {PACKAGE_TYPE_LABELS[d.packageType as PackageType] ?? d.packageType}
          </span>
          {d.fragile && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">📦 Frágil</span>
          )}
        </div>
        <span className="text-[10px] text-slate-500">{timeAgo(d.requestedAt)}</span>
      </div>
      <Waypoint kind="pickup" address={d.pickup?.address} note={d.pickup?.note} />
      {d.packageNote && (
        <p className="text-[11px] text-slate-500 italic leading-snug">“{d.packageNote}”</p>
      )}
      <div className="flex items-center justify-between border-t border-border-subtle pt-2">
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-500" aria-hidden="true" /> {d.distanceKm} km
          </span>
          <span>{d.durationMin} min</span>
          {d.payableOnDelivery && (
            <span className="inline-flex items-center gap-0.5 text-emerald-brand font-bold">
              <Banknote className="w-3 h-3" aria-hidden="true" /> al recibir
            </span>
          )}
        </div>
        <span className="font-extrabold text-emerald-brand font-display text-sm">{cup(d.totalFareCup)}</span>
      </div>
      <button
        onClick={onAccept}
        disabled={isActing}
        className="w-full min-h-11 rounded-lg bg-emerald-brand hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold transition-colors"
      >
        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" aria-label="Aceptando carrera" /> : `Aceptar carrera ${d.code}`}
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
              d.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : 'bg-cerulean/10 text-cerulean-dark'
            }`}>
              {STATUS_LABELS[d.status]}
            </span>
          </div>
          <span className="font-extrabold text-emerald-brand font-display text-sm">{cup(d.totalFareCup)}</span>
        </div>
        {d.requester && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <User className="w-3.5 h-3.5 text-cerulean" aria-hidden="true" /> Cliente: {d.requester.name}
          </div>
        )}
        <div className="grid gap-1.5 pt-1">
          <Waypoint kind="pickup" address={d.pickup?.address} note={d.pickup?.note} />
          <Waypoint kind="dropoff" address={d.dropoff?.address} note={d.dropoff?.note} />
        </div>
        {d.packageNote && (
          <p className="text-[11px] text-slate-500 italic leading-snug pt-1">“{d.packageNote}”</p>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border-subtle p-3 bg-white">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2" id="messenger-progress-label">
          Avance de la carrera
        </p>
        <ol className="relative pl-5" aria-labelledby="messenger-progress-label">
          {STEP_FLOW.map((s, i) => {
            const done = i <= stepCursor && d.status !== 'CANCELLED' && d.status !== 'EXPIRED';
            const current = d.status === s.status;
            return (
              <li key={s.status} className="relative pb-3 last:pb-0" aria-current={current ? 'step' : undefined}>
                {i < STEP_FLOW.length - 1 && (
                  <span aria-hidden="true" className={`absolute left-[5px] top-4 bottom-0 w-[2px] ${done ? 'bg-emerald-brand' : 'bg-slate-200'}`} />
                )}
                <span aria-hidden="true" className={`absolute left-0 top-0 w-[11px] h-[11px] rounded-full border-2 ${done ? 'bg-emerald-brand border-emerald-brand' : 'bg-white border-slate-400'}`} />
                <p className={`text-xs font-bold ${done ? 'text-emerald-700' : current ? 'text-cerulean-dark' : 'text-slate-500'}`}>
                  {s.label}
                  {current && (
                    <span className="ml-1.5 rounded px-1 py-0.5 bg-cerulean/10 text-cerulean-dark text-[10px] font-extrabold uppercase tracking-wide">
                      En curso
                    </span>
                  )}
                  {done && !current && <span className="sr-only"> (completado)</span>}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      {nextAction && (
        <button
          onClick={() => onStep(nextAction.action)}
          disabled={isActing}
          className="w-full min-h-11 py-2.5 rounded-lg bg-emerald-brand hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold transition-colors inline-flex items-center justify-center gap-2"
        >
          {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Package className="w-3.5 h-3.5" aria-hidden="true" />}
          {nextAction.label}
        </button>
      )}
      {d.status === 'DELIVERED' && (
        <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 py-1">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Carrera completada
        </p>
      )}
    </div>
  );
}

/** Aviso de vencimiento sobre el tablón. Solo aparece cuando queda poco. */
function SubscriptionStrip({
  daysLeft,
  expiresAt,
  pendingRenewal,
  onRenew
}: {
  daysLeft: number;
  expiresAt: string | null;
  pendingRenewal: boolean;
  onRenew: () => void;
}) {
  if (daysLeft > DIAS_AVISO_RENOVACION) return null;
  const urgente = daysLeft <= 2;

  return (
    <div
      role="status"
      className={`flex flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
        urgente ? 'border-amber-200 bg-amber-50' : 'border-border-subtle bg-slate-50'
      }`}
    >
      <p className="flex items-start gap-2 text-[11px] leading-snug text-slate-700">
        <CalendarClock className={`mt-0.5 h-4 w-4 shrink-0 ${urgente ? 'text-saffron' : 'text-slate-500'}`} aria-hidden="true" />
        <span>
          Tu suscripción vence el <strong className="font-extrabold">{fechaCorta(expiresAt)}</strong> —{' '}
          {diasRestantes(daysLeft)}.
        </span>
      </p>
      {pendingRenewal ? (
        <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600 ring-1 ring-border-subtle">
          Renovación en revisión
        </span>
      ) : (
        <button
          onClick={onRenew}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-brand px-3 text-xs font-extrabold text-white transition-colors hover:bg-emerald-700 sm:w-auto"
        >
          <TimerReset className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Renovar
        </button>
      )}
    </div>
  );
}

export default function GoogleMapsMessengerModal({ isOpen, onClose, onOpenAuth, user, deliveries, application }: GoogleMapsMessengerModalProps) {
  const isMessenger = user?.role === 'MESSENGER';
  const applicationData = application.data;
  const latestPayment = applicationData?.payments[0];
  const profile = applicationData?.profile;
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const [showRenewal, setShowRenewal] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(isOpen);

  // Ajuste de estado al cambiar una prop, en render y no en un efecto: cerrar
  // el modal descarta la vista de renovación para no reabrir en ella.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen && showRenewal) setShowRenewal(false);
  }

  // Suscripción: mientras la petición vuelve se asume viva, para no parpadear
  // la pantalla de renovación a cada apertura del modal.
  const subscriptionActive = applicationData ? applicationData.subscriptionActive : true;
  const pendingRenewal = applicationData?.pendingPayment?.kind === 'renovacion';
  const renewing = isMessenger && (!subscriptionActive || showRenewal);

  React.useEffect(() => {
    if (isOpen && isMessenger) {
      void deliveries.refreshMessenger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Navegación por flechas entre pestañas, como exige el patrón ARIA tabs.
  const onTabsKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const delta = keys[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const current = TAB_ORDER.indexOf(deliveries.messengerTab as MessengerTab);
    const next = TAB_ORDER[(current + delta + TAB_ORDER.length) % TAB_ORDER.length];
    deliveries.setMessengerTab(next);
    tabsRef.current?.querySelector<HTMLElement>(`#messenger-tab-${next}`)?.focus();
  };

  const tabClass = (tab: MessengerTab) =>
    `flex-1 min-h-11 rounded-lg text-xs font-extrabold transition-colors ${
      deliveries.messengerTab === tab ? 'bg-white text-cerulean-dark shadow-level-1' : 'text-slate-600 hover:text-slate-800'
    }`;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="messenger-modal-title"
      describedBy="messenger-modal-subtitle"
      overlayClassName="z-[60] p-3 sm:p-5"
      panelClassName="bg-white rounded-xl shadow-level-4 border border-border-subtle/90 w-full max-w-lg max-h-[94dvh] animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="px-4 sm:px-5 py-4 bg-navy text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cerulean/20 border border-cerulean/40 text-cerulean-light flex items-center justify-center shadow-inner flex-shrink-0">
            <Bike className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="messenger-modal-title" className="text-base font-extrabold text-white font-display">Mensajería</h2>
            <p id="messenger-modal-subtitle" className="text-[11px] text-slate-400">Tablón de carreras para mensajeros</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar mensajería"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {!isMessenger ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {!user ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-cerulean/10 border border-cerulean/20 text-cerulean flex items-center justify-center">
                <User className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-extrabold text-slate-800">Inicia sesión para solicitar el alta</p>
                <p className="text-xs text-slate-500 mt-1">Necesitas una cuenta activa para postularte como mensajero.</p>
              </div>
              <button
                onClick={onOpenAuth}
                className="min-h-11 px-4 rounded-lg bg-emerald-brand text-white text-xs font-extrabold hover:bg-emerald-700 transition-colors"
              >
                Iniciar sesión o registrarse
              </button>
            </div>
          ) : application.isLoading ? (
            <div role="status" className="flex h-full items-center justify-center gap-2 text-xs font-bold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Cargando requisitos...
            </div>
          ) : application.error && !applicationData ? (
            <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-crimson" aria-hidden="true" />
              <p className="text-sm font-extrabold text-slate-800">No se pudo cargar la solicitud</p>
              <p className="text-xs text-slate-500">{application.error}</p>
              <button
                onClick={() => void application.refresh()}
                className="min-h-11 px-4 rounded-lg border border-border-subtle text-xs font-extrabold text-slate-600 hover:bg-slate-50"
              >
                Reintentar
              </button>
            </div>
          ) : !applicationData ? (
            <div className="flex h-full items-center justify-center text-xs font-bold text-slate-500">
              No hay información disponible
            </div>
          ) : profile?.status === 'SUSPENDED' ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-crimson flex items-center justify-center">
                <XCircle className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-extrabold text-slate-800">Perfil suspendido</p>
              <p className="text-xs text-slate-500">Contacta con el administrador para revisar el estado de tu cuenta.</p>
            </div>
          ) : profile?.status === 'ACTIVE' ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-extrabold text-slate-800">Alta aprobada</p>
              <p className="text-xs text-slate-500">Actualiza tu sesión para entrar al tablón de carreras.</p>
              <button
                onClick={() => void application.refresh()}
                className="min-h-11 px-4 rounded-lg bg-emerald-brand text-white text-xs font-extrabold hover:bg-emerald-700"
              >
                Actualizar cuenta
              </button>
            </div>
          ) : profile?.status === 'PENDING' && latestPayment?.status === 'PENDING' ? (
            <ApplicationPending
              platform={applicationData.platform}
              payment={latestPayment}
              onRefresh={() => void application.refresh()}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cerulean/10 text-cerulean flex items-center justify-center">
                    <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">Quiero ser mensajero</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Completa tu perfil y reporta el pago para activar tu cuenta.</p>
                  </div>
                </div>
                {application.error && (
                  <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-crimson">
                    {application.error}
                  </div>
                )}
              </div>
              <ApplicationForm
                platform={applicationData.platform}
                isSubmitting={application.isSubmitting}
                kind="alta"
                onSubmit={application.submit}
              />
            </div>
          )}
        </div>
      ) : renewing ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                subscriptionActive ? 'bg-cerulean/10 text-cerulean' : 'bg-amber-100 text-saffron'
              }`}
            >
              <TimerReset className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-800">
                {subscriptionActive ? 'Renovar suscripción' : 'Tu suscripción venció'}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                {subscriptionActive
                  ? `Vence el ${fechaCorta(applicationData?.expiresAt ?? null)}. Los días que te queden se suman al periodo nuevo.`
                  : 'Conservas tu perfil y tu historial, pero no puedes aceptar carreras nuevas hasta renovar.'}
              </p>
            </div>
          </div>

          {application.error && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-crimson">
              {application.error}
            </div>
          )}

          {pendingRenewal ? (
            <ApplicationPending
              platform={applicationData!.platform}
              payment={applicationData!.pendingPayment ?? undefined}
              onRefresh={() => void application.refresh()}
            />
          ) : applicationData ? (
            <ApplicationForm
              platform={applicationData.platform}
              isSubmitting={application.isSubmitting}
              kind="renovacion"
              defaults={{
                vehicle: applicationData.profile?.vehicle,
                serviceAreas: applicationData.profile?.serviceAreas
              }}
              onSubmit={application.submit}
            />
          ) : (
            <div role="status" className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando datos de pago...
            </div>
          )}

          {subscriptionActive && (
            <button
              onClick={() => setShowRenewal(false)}
              className="w-full min-h-11 rounded-lg border border-border-subtle bg-white px-3 text-xs font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Volver al tablón
            </button>
          )}
        </div>
      ) : (
        <>
          <SubscriptionStrip
            daysLeft={applicationData?.daysLeft ?? 999}
            expiresAt={applicationData?.expiresAt ?? null}
            pendingRenewal={pendingRenewal}
            onRenew={() => setShowRenewal(true)}
          />

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-50 border-b border-border-subtle p-1.5 flex-shrink-0">
            <div ref={tabsRef} role="tablist" aria-label="Vistas de mensajería" onKeyDown={onTabsKeyDown} className="flex flex-1 items-center gap-1">
              <button
                id="messenger-tab-available"
                role="tab"
                type="button"
                aria-selected={deliveries.messengerTab === 'available'}
                aria-controls="messenger-panel"
                tabIndex={deliveries.messengerTab === 'available' ? 0 : -1}
                onClick={() => deliveries.setMessengerTab('available')}
                className={tabClass('available')}
              >
                Carreras {!deliveries.isFetchingAvailable && deliveries.messengerAvailable.length > 0 && `(${deliveries.messengerAvailable.length})`}
              </button>
              <button
                id="messenger-tab-active"
                role="tab"
                type="button"
                aria-selected={deliveries.messengerTab === 'active'}
                aria-controls="messenger-panel"
                tabIndex={deliveries.messengerTab === 'active' ? 0 : -1}
                onClick={() => deliveries.setMessengerTab('active')}
                className={tabClass('active')}
              >
                Mi carrera
                {deliveries.messengerActive && (
                  <>
                    <span aria-hidden="true" className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-brand align-middle" />
                    <span className="sr-only"> (tienes una carrera en curso)</span>
                  </>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void deliveries.refreshMessenger()}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:text-cerulean hover:bg-slate-100 transition-colors"
              aria-label="Actualizar carreras"
            >
              <RefreshCw className={`w-4 h-4 ${deliveries.isFetchingAvailable ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>

          <div
            id="messenger-panel"
            role="tabpanel"
            aria-labelledby={`messenger-tab-${deliveries.messengerTab}`}
            tabIndex={0}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {deliveries.messengerTab === 'available' ? (
              deliveries.isFetchingAvailable && deliveries.messengerAvailable.length === 0 ? (
                <div role="status" className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Buscando carreras...
                </div>
              ) : deliveries.messengerAvailable.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-slate-600">No hay carreras pendientes</p>
                  <p className="text-xs text-slate-500 mt-1">Nuevas solicitudes aparecerán aquí al instante.</p>
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
                <p className="text-xs text-slate-500 mt-1">Acepta una del tablón para empezar.</p>
                <button
                  onClick={() => deliveries.setMessengerTab('available')}
                  className="mt-3 min-h-11 px-4 rounded-lg bg-emerald-brand hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors"
                >
                  Ver carreras disponibles
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </ModalShell>
  );
}
