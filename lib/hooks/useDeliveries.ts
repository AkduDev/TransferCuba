'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { reverseNominatimCoords } from '@/lib/nominatim';
import {
  PACKAGE_TYPES,
  type AvailableDeliveryDTO,
  type CreateDeliveryInput,
  type DeliveryDTO,
  type DeliveryPoint,
  type DeliveryReviewDTO,
  type DeliveryStatus,
  type EstimateResult,
  type MessengerStatsDTO,
  type PackageType
} from '@/lib/delivery-client';
import type { AuthRole } from '@/lib/hooks/useAuth';

type View = 'form' | 'success' | 'pick' | 'history';
type MessengerStep = 'pick_up' | 'in_transit' | 'deliver';

const ACTIVE_STATUSES = new Set<DeliveryStatus>(['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']);
const TERMINAL_STATUSES = new Set<DeliveryStatus>(['DELIVERED', 'CANCELLED', 'EXPIRED']);

const STATUS_CHANGE_MESSAGES: Partial<Record<DeliveryStatus, string>> = {
  ACCEPTED: 'Un mensajero aceptó tu envío',
  PICKED_UP: 'Tu paquete fue recogido',
  IN_TRANSIT: 'Tu paquete va en camino al destino',
  DELIVERED: 'Tu envío fue entregado',
  CANCELLED: 'Tu envío fue cancelado',
  EXPIRED: 'Tu envío expiró sin mensajero'
};

export interface UseDeliveriesState {
  view: View;
  setView: (v: View) => void;
  picking: 'pickup' | 'dropoff' | null;
  startPicking: (target: 'pickup' | 'dropoff') => void;
  cancelPicking: () => void;
  setPickedPoint: (coords: { lat: number; lng: number }) => void;
  setPickupFromCoords: (coords: { lat: number; lng: number }) => void;
  pickup: DeliveryPoint | null;
  dropoff: DeliveryPoint | null;
  packageType: PackageType;
  setPackageType: (v: PackageType) => void;
  packageNote: string;
  setPackageNote: (v: string) => void;
  fragile: boolean;
  setFragile: (v: boolean) => void;
  payableOnDelivery: boolean;
  setPayableOnDelivery: (v: boolean) => void;
  estimate: EstimateResult | null;
  isEstimating: boolean;
  isSubmitting: boolean;
  lastDelivery: DeliveryDTO | null;
  history: DeliveryDTO[];
  isOpeningHistory: boolean;
  openForm: () => void;
  openSuccess: (d: DeliveryDTO) => void;
  openHistory: () => void;
  submit: () => Promise<void>;
  reset: () => void;

  messengerAvailable: AvailableDeliveryDTO[];
  messengerActive: DeliveryDTO | null;
  messengerHistory: DeliveryDTO[];
  isFetchingAvailable: boolean;
  isActing: boolean;
  messengerTab: 'available' | 'active' | 'history' | 'stats';
  setMessengerTab: (v: 'available' | 'active' | 'history' | 'stats') => void;
  refreshMessenger: (silent?: boolean) => Promise<void>;
  openMessengerHistory: () => Promise<void>;
  acceptAvailable: (id: string) => Promise<void>;
  messengerStep: (action: MessengerStep) => Promise<void>;

  requesterActive: DeliveryDTO | null;
  isMessenger: boolean;
  isTracking: boolean;

  /* --- Fase 6 --- */
  /** Estado del canal en vivo. `fallback` = SSE descartado, manda el polling. */
  streamState: StreamState;
  historyCursor: string | null;
  isLoadingMoreHistory: boolean;
  loadMoreHistory: () => Promise<void>;
  reviewsByDelivery: Record<string, DeliveryReviewDTO>;
  isSubmittingReview: boolean;
  submitReview: (deliveryId: string, rating: number, comment: string) => Promise<boolean>;
  messengerStats: MessengerStatsDTO | null;
  refreshMessengerStats: () => Promise<void>;
}

export type StreamState = 'disconnected' | 'connecting' | 'connected' | 'fallback';

/** Fallos seguidos del stream antes de rendirse y dejar el polling al mando. */
const MAX_FALLOS_STREAM = 3;

interface ApiErrorBody {
  error?: string;
}

/**
 * Lee el mensaje de error de una respuesta ya parseada. `Response.json()`
 * consume el stream, así que releerlo lanza y el texto real del servidor se
 * perdía: quien llama pasa el cuerpo que ya tiene.
 */
function errorDe(body: ApiErrorBody | null, fallback: string): string {
  return body?.error ?? fallback;
}

/** Para respuestas cuyo cuerpo aún no se ha leído. */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useDeliveries(opts: { showToast: (msg: string) => void; role: AuthRole | null }): UseDeliveriesState {
  const { showToast, role } = opts;
  const [view, setView] = useState<View>('form');
  const [picking, setPicking] = useState<'pickup' | 'dropoff' | null>(null);
  const [pickup, setPickup] = useState<DeliveryPoint | null>(null);
  const [dropoff, setDropoff] = useState<DeliveryPoint | null>(null);
  const [packageType, setPackageType] = useState<PackageType>('comida');
  const [packageNote, setPackageNote] = useState('');
  const [fragile, setFragile] = useState(false);
  const [payableOnDelivery, setPayableOnDelivery] = useState(true);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastDelivery, setLastDelivery] = useState<DeliveryDTO | null>(null);
  const [history, setHistory] = useState<DeliveryDTO[]>([]);
  const [isOpeningHistory, setIsOpeningHistory] = useState(false);

  const [messengerAvailable, setMessengerAvailable] = useState<AvailableDeliveryDTO[]>([]);
  const [messengerActive, setMessengerActive] = useState<DeliveryDTO | null>(null);
  const [messengerHistory, setMessengerHistory] = useState<DeliveryDTO[]>([]);
  const [isFetchingAvailable, setIsFetchingAvailable] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [messengerTab, setMessengerTab] = useState<'available' | 'active' | 'history' | 'stats'>('available');

  const [requesterActive, setRequesterActive] = useState<DeliveryDTO | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  /* --- Fase 6 --- */
  const [streamState, setStreamState] = useState<StreamState>('disconnected');
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [reviewsByDelivery, setReviewsByDelivery] = useState<Record<string, DeliveryReviewDTO>>({});
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [messengerStats, setMessengerStats] = useState<MessengerStatsDTO | null>(null);

  const estimateTokenRef = useRef(0);
  const requesterActiveRef = useRef<DeliveryDTO | null>(null);
  const messengerActiveRef = useRef<DeliveryDTO | null>(null);
  const messengerAvailableRef = useRef<AvailableDeliveryDTO[]>([]);

  useEffect(() => {
    requesterActiveRef.current = requesterActive;
  }, [requesterActive]);

  useEffect(() => {
    messengerActiveRef.current = messengerActive;
  }, [messengerActive]);

  useEffect(() => {
    messengerAvailableRef.current = messengerAvailable;
  }, [messengerAvailable]);

  const openForm = useCallback(() => {
    setView('form');
    setPicking(null);
  }, []);

  const openSuccess = useCallback((d: DeliveryDTO) => {
    setLastDelivery(d);
    setTrackingId(d.id);
    setRequesterActive(d);
    setView('success');
  }, []);

  const reset = useCallback(() => {
    setPickup(null);
    setDropoff(null);
    setPackageType('comida');
    setPackageNote('');
    setFragile(false);
    setPayableOnDelivery(true);
    setEstimate(null);
    setLastDelivery(null);
    setPicking(null);
    setView('form');
  }, []);

  const startPicking = useCallback((target: 'pickup' | 'dropoff') => {
    setPicking(target);
    setView('pick');
  }, []);

  const cancelPicking = useCallback(() => {
    setPicking(null);
    setView('form');
  }, []);

  const setPickedPoint = useCallback(
    async (coords: { lat: number; lng: number }) => {
      const target = picking;
      const point: DeliveryPoint = {
        lat: coords.lat,
        lng: coords.lng,
        address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
      };
      if (target === 'pickup') setPickup(point);
      else if (target === 'dropoff') setDropoff(point);
      setPicking(null);
      setView('form');
      const label = await reverseNominatimCoords(coords.lat, coords.lng);
      if (!label) return;
      const parts = label.split(',').map((p) => p.trim());
      const updated = point;
      updated.address = parts.slice(0, 3).join(', ');
      if (target === 'pickup') setPickup({ ...updated });
      else if (target === 'dropoff') setDropoff({ ...updated });
    },
    [picking]
  );

  const setPickupFromCoords = useCallback(async (coords: { lat: number; lng: number }) => {
    const point: DeliveryPoint = {
      lat: coords.lat,
      lng: coords.lng,
      address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
    };
    setPickup(point);
    const label = await reverseNominatimCoords(coords.lat, coords.lng);
    if (label) point.address = label.split(',').map((p) => p.trim()).slice(0, 3).join(', ');
    setPickup({ ...point });
  }, []);

  // Estimate con debounce cuando hay origen + destino.
  useEffect(() => {
    if (!pickup || !dropoff) {
      setEstimate(null);
      return;
    }
    const token = ++estimateTokenRef.current;
    setIsEstimating(true);
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({
          fromLat: String(pickup.lat),
          fromLng: String(pickup.lng),
          toLat: String(dropoff.lat),
          toLng: String(dropoff.lng)
        });
        const res = await fetch(`/api/deliveries/estimate?${qs}`, { cache: 'no-store' });
        if (token !== estimateTokenRef.current) return;
        if (res.ok) {
          const body = (await res.json()) as { success: boolean; estimate?: EstimateResult } & Partial<EstimateResult>;
          setEstimate(
            body.estimate ?? {
              distanceMeters: body.distanceMeters ?? 0,
              distanceKm: body.distanceKm ?? 0,
              durationMin: body.durationMin ?? 0,
              totalFareCup: body.totalFareCup ?? 0,
              breakdown: { baseCup: 0, paidKm: 0, details: [] }
            }
          );
        } else {
          setEstimate(null);
          if (res.status === 502) showToast('No se pudo calcular la ruta ahora.');
        }
      } catch {
        if (token === estimateTokenRef.current) setEstimate(null);
      } finally {
        if (token === estimateTokenRef.current) setIsEstimating(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [pickup, dropoff, showToast]);

  const submit = useCallback(async () => {
    if (!pickup || !dropoff) {
      showToast('Marca origen y destino en el mapa.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const input: CreateDeliveryInput = {
        packageType,
        packageNote: packageNote.trim() || undefined,
        fragile,
        payableOnDelivery,
        pickup,
        dropoff
      };
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      const body = (await res.json().catch(() => null)) as
        | ({ success?: boolean; delivery?: DeliveryDTO } & ApiErrorBody)
        | null;
      if (!res.ok || !body?.success || !body.delivery) {
        showToast(errorDe(body, 'No se pudo crear la carrera'));
        return;
      }
      openSuccess(body.delivery);
    } finally {
      setIsSubmitting(false);
    }
  }, [pickup, dropoff, packageType, packageNote, fragile, payableOnDelivery, isSubmitting, openSuccess, showToast]);

  /* ------------------ Fase 6: stats del mensajero ------------------ */

  const refreshMessengerStats = useCallback(async () => {
    try {
      const me = await fetch('/api/account/me', { cache: 'no-store' });
      if (!me.ok) return;
      const { user } = (await me.json()) as { user?: { id?: string } };
      if (!user?.id) return;
      const res = await fetch(`/api/messengers/${user.id}/stats`, { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as { stats?: MessengerStatsDTO };
      if (body.stats) setMessengerStats(body.stats);
    } catch {
      // sin red: se reintenta al reabrir el panel
    }
  }, []);

  const openHistory = useCallback(async () => {
    setIsOpeningHistory(true);
    try {
      const res = await fetch('/api/deliveries/history?limit=20', { cache: 'no-store' });
      if (res.ok) {
        const body = (await res.json()) as { deliveries?: DeliveryDTO[]; nextCursor?: string | null };
        setHistory(body.deliveries ?? []);
        setHistoryCursor(body.nextCursor ?? null);
        setView('history');
      } else {
        showToast(await readError(res, 'No se pudo cargar el historial'));
      }
      if (role === 'MESSENGER') void refreshMessengerStats();
    } finally {
      setIsOpeningHistory(false);
    }
  }, [showToast, role, refreshMessengerStats]);

  /** Carga el historial del mensajero (para el tab "Historial" del modal de mensajería). */
  const openMessengerHistory = useCallback(async () => {
    setIsOpeningHistory(true);
    try {
      const res = await fetch('/api/deliveries/history?limit=20', { cache: 'no-store' });
      if (res.ok) {
        const body = (await res.json()) as { deliveries?: DeliveryDTO[]; nextCursor?: string | null };
        setMessengerHistory(body.deliveries ?? []);
        setHistoryCursor(body.nextCursor ?? null);
      } else {
        showToast(await readError(res, 'No se pudo cargar el historial'));
      }
      void refreshMessengerStats();
    } finally {
      setIsOpeningHistory(false);
    }
  }, [showToast, refreshMessengerStats]);

  /* ------------------ modo mensajero ------------------ */

  const refreshMessenger = useCallback(async (silent = false) => {
    const hasData = messengerAvailableRef.current.length > 0;
    if (!silent || !hasData) setIsFetchingAvailable(true);
    try {
      const [availRes, mineRes] = await Promise.all([
        fetch('/api/deliveries/available', { cache: 'no-store' }),
        fetch('/api/deliveries', { cache: 'no-store' })
      ]);
      if (availRes.ok) {
        const avail = (await availRes.json()) as { deliveries?: AvailableDeliveryDTO[] };
        setMessengerAvailable(avail.deliveries ?? []);
      }
      if (mineRes.ok) {
        const mine = (await mineRes.json()) as { deliveries?: DeliveryDTO[] };
        const all = mine.deliveries ?? [];
        setMessengerHistory(all);
        const active =
          all.find((d) =>
            d.status === 'ACCEPTED' || d.status === 'PICKED_UP' || d.status === 'IN_TRANSIT'
          ) ?? null;
        setMessengerActive(active);
        const previous = messengerActiveRef.current;
        if (active && !previous) setMessengerTab('active');
      }
    } finally {
      setIsFetchingAvailable(false);
    }
  }, []);

  const acceptAvailable = useCallback(
    async (id: string) => {
      setIsActing(true);
      try {
        const res = await fetch(`/api/deliveries/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'accept' })
        });
        const body = (await res.json().catch(() => null)) as
          | ({ success?: boolean; delivery?: DeliveryDTO } & ApiErrorBody)
          | null;
        if (!res.ok || !body?.success || !body.delivery) {
          showToast(errorDe(body, 'No se pudo aceptar la carrera'));
          return;
        }
        setMessengerActive(body.delivery);
        setMessengerTab('active');
        setMessengerAvailable((prev) => prev.filter((d) => d.id !== id));
        showToast(`\u{2713} Carrera ${body.delivery.code} aceptada`);
      } finally {
        setIsActing(false);
      }
    },
    [showToast]
  );

  const messengerStep = useCallback(
    async (action: MessengerStep) => {
      if (!messengerActive) return;
      const id = messengerActive.id;
      setIsActing(true);
      try {
        const res = await fetch(`/api/deliveries/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
        const body = (await res.json().catch(() => null)) as
          | ({ success?: boolean; delivery?: DeliveryDTO } & ApiErrorBody)
          | null;
        if (!res.ok || !body?.success || !body.delivery) {
          showToast(errorDe(body, 'No se pudo actualizar la carrera'));
          return;
        }
        setMessengerActive(body.delivery);
      } finally {
        setIsActing(false);
      }
    },
    [messengerActive, showToast]
  );

  /** Trae una página más del historial y la añade al final. */
  const loadMoreHistory = useCallback(async () => {
    if (!historyCursor || isLoadingMoreHistory) return;
    setIsLoadingMoreHistory(true);
    try {
      const res = await fetch(
        `/api/deliveries/history?limit=20&cursor=${encodeURIComponent(historyCursor)}`,
        { cache: 'no-store' }
      );
      const body = (await res.json().catch(() => null)) as
        | ({ deliveries?: DeliveryDTO[]; nextCursor?: string | null } & ApiErrorBody)
        | null;
      if (!res.ok || !body) {
        showToast(errorDe(body, 'No se pudo cargar más historial'));
        return;
      }
      const nuevas = body.deliveries ?? [];
      // Se filtra por id: si llega una repetida por una carrera en el límite de
      // página, no se duplica en pantalla.
      setHistory((prev) => {
        const vistos = new Set(prev.map((d) => d.id));
        return [...prev, ...nuevas.filter((d) => !vistos.has(d.id))];
      });
      setMessengerHistory((prev) => {
        const vistos = new Set(prev.map((d) => d.id));
        return [...prev, ...nuevas.filter((d) => !vistos.has(d.id))];
      });
      setHistoryCursor(body.nextCursor ?? null);
    } finally {
      setIsLoadingMoreHistory(false);
    }
  }, [historyCursor, isLoadingMoreHistory, showToast]);

  const submitReview = useCallback(
    async (deliveryId: string, rating: number, comment: string) => {
      if (isSubmittingReview) return false;
      setIsSubmittingReview(true);
      try {
        const res = await fetch(`/api/deliveries/${deliveryId}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, comment: comment.trim() })
        });
        const body = (await res.json().catch(() => null)) as
          | ({ success?: boolean; review?: DeliveryReviewDTO } & ApiErrorBody)
          | null;
        if (!res.ok || !body?.success || !body.review) {
          showToast(errorDe(body, 'No se pudo enviar la valoración'));
          return false;
        }
        setReviewsByDelivery((prev) => ({ ...prev, [deliveryId]: body.review! }));
        showToast('\u{2713} Valoración enviada');
        return true;
      } finally {
        setIsSubmittingReview(false);
      }
    },
    [isSubmittingReview, showToast]
  );

  /* ------------------ Fase 4: seguimiento en vivo ------------------ */

  // Al iniciar sesión, retoma el seguimiento de la carrera activa pendiente.
  useEffect(() => {
    if (!role || role === 'MESSENGER') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/deliveries', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { deliveries?: DeliveryDTO[] };
        const active = (body.deliveries ?? []).find((d) => ACTIVE_STATUSES.has(d.status));
        if (active && !cancelled) {
          setTrackingId(active.id);
          setRequesterActive(active);
        }
      } catch {
        // sin BD o red: se reintenta con el siguiente ciclo de autenticación
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Polling de la carrera activa del solicitante (12 s) mientras haya tracking.
  useEffect(() => {
    if (!trackingId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/deliveries', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { deliveries?: DeliveryDTO[] };
        const current = (body.deliveries ?? []).find((d) => d.id === trackingId);
        if (!current || cancelled) return;
        setRequesterActive(current);
        const prevStatus = requesterActiveRef.current?.status;
        if (prevStatus && prevStatus !== current.status) {
          const msg = STATUS_CHANGE_MESSAGES[current.status];
          if (msg) showToast(msg);
        }
        if (TERMINAL_STATUSES.has(current.status)) {
          setTrackingId(null);
        }
      } catch {
        // red caída: el próximo tick reintenta
      }
    };
    void check();
    const t = setInterval(() => void check(), 12000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [trackingId, showToast]);

  // Polling del tablón y carrera activa del mensajero (15 s).
  useEffect(() => {
    if (role !== 'MESSENGER') return;
    void refreshMessenger(true);
    const t = setInterval(() => void refreshMessenger(true), 15000);
    return () => clearInterval(t);
  }, [role, refreshMessenger]);

  return {
    view, setView,
    picking,
    startPicking,
    cancelPicking,
    setPickedPoint,
    setPickupFromCoords,
    pickup, dropoff,
    packageType, setPackageType,
    packageNote, setPackageNote,
    fragile, setFragile,
    payableOnDelivery, setPayableOnDelivery,
    estimate, isEstimating,
    isSubmitting,
    lastDelivery,
    history, isOpeningHistory,
    openForm,
    openSuccess,
    openHistory,
    submit,
    reset,
    messengerAvailable,
    messengerActive,
    messengerHistory,
    isFetchingAvailable,
    isActing,
    messengerTab, setMessengerTab,
    refreshMessenger,
    openMessengerHistory,
    acceptAvailable,
    messengerStep,
    requesterActive,
    isMessenger: role === 'MESSENGER',
    isTracking: trackingId !== null,
    streamState,
    historyCursor,
    isLoadingMoreHistory,
    loadMoreHistory,
    reviewsByDelivery,
    isSubmittingReview,
    submitReview,
    messengerStats,
    refreshMessengerStats
  };
}