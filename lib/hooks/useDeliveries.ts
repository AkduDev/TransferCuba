'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { reverseNominatimCoords } from '@/lib/nominatim';
import {
  PACKAGE_TYPES,
  type AvailableDeliveryDTO,
  type CreateDeliveryInput,
  type DeliveryDTO,
  type DeliveryPoint,
  type DeliveryStatus,
  type EstimateResult,
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
  messengerTab: 'available' | 'active';
  setMessengerTab: (v: 'available' | 'active') => void;
  refreshMessenger: (silent?: boolean) => Promise<void>;
  acceptAvailable: (id: string) => Promise<void>;
  messengerStep: (action: MessengerStep) => Promise<void>;

  requesterActive: DeliveryDTO | null;
  isMessenger: boolean;
  isTracking: boolean;
}

interface ApiErrorBody {
  error?: string;
}

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
  const [messengerTab, setMessengerTab] = useState<'available' | 'active'>('available');

  const [requesterActive, setRequesterActive] = useState<DeliveryDTO | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);

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
      const body = (await res.json()) as { success?: boolean; delivery?: DeliveryDTO };
      if (!res.ok || !body.success || !body.delivery) {
        showToast(await readError(res, 'No se pudo crear la carrera'));
        return;
      }
      openSuccess(body.delivery);
    } finally {
      setIsSubmitting(false);
    }
  }, [pickup, dropoff, packageType, packageNote, fragile, payableOnDelivery, isSubmitting, openSuccess, showToast]);

  const openHistory = useCallback(async () => {
    setIsOpeningHistory(true);
    try {
      const res = await fetch('/api/deliveries', { cache: 'no-store' });
      if (res.ok) {
        const body = (await res.json()) as { deliveries?: DeliveryDTO[] };
        setHistory(body.deliveries ?? []);
        setView('history');
      } else {
        showToast(await readError(res, 'No se pudo cargar el historial'));
      }
    } finally {
      setIsOpeningHistory(false);
    }
  }, [showToast]);

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
        const body = (await res.json()) as { success?: boolean; delivery?: DeliveryDTO };
        if (!res.ok || !body.success || !body.delivery) {
          showToast(await readError(res, 'No se pudo aceptar la carrera'));
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
        const body = (await res.json()) as { success?: boolean; delivery?: DeliveryDTO };
        if (!res.ok || !body.success || !body.delivery) {
          showToast(await readError(res, 'No se pudo actualizar la carrera'));
          return;
        }
        setMessengerActive(body.delivery);
      } finally {
        setIsActing(false);
      }
    },
    [messengerActive, showToast]
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
    acceptAvailable,
    messengerStep,
    requesterActive,
    isMessenger: role === 'MESSENGER',
    isTracking: trackingId !== null
  };
}