'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { reverseNominatimCoords } from '@/lib/nominatim';
import {
  PACKAGE_TYPES,
  type AvailableDeliveryDTO,
  type CreateDeliveryInput,
  type DeliveryDTO,
  type DeliveryPoint,
  type EstimateResult,
  type PackageType
} from '@/lib/delivery-client';

type View = 'form' | 'success' | 'pick' | 'history';
type MessengerStep = 'pick_up' | 'in_transit' | 'deliver';

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
  refreshMessenger: () => Promise<void>;
  acceptAvailable: (id: string) => Promise<void>;
  messengerStep: (action: MessengerStep) => Promise<void>;
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

export function useDeliveries(opts: { showToast: (msg: string) => void }): UseDeliveriesState {
  const showToast = opts.showToast;
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

  const estimateTokenRef = useRef(0);

  const openForm = useCallback(() => {
    setView('form');
    setPicking(null);
  }, []);

  const openSuccess = useCallback((d: DeliveryDTO) => {
    setLastDelivery(d);
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

  const refreshMessenger = useCallback(async () => {
    setIsFetchingAvailable(true);
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
        const active = all.find((d) =>
          d.status === 'ACCEPTED' || d.status === 'PICKED_UP' || d.status === 'IN_TRANSIT'
        );
        setMessengerActive(active ?? null);
        if (active) setMessengerTab('active');
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
    messengerStep
  };
}