'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/lib/hooks/useToast';
import type { AuthRole } from '@/lib/hooks/useAuth';

export type MessengerVehicle = 'pie' | 'bicicleta' | 'moto' | 'auto' | 'otro';
export type MessengerProfileStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type MessengerPaymentStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'REJECTED';
export type MessengerPaymentMethod = 'efectivo' | 'transferencia';
export type MessengerPaymentKind = 'alta' | 'renovacion';

export interface MessengerPlatformConfig {
  messengerFeeCup: number;
  /** Días de validez que otorga un pago confirmado. */
  messengerPeriodDays: number;
  messengerPayCard: string;
  messengerWhatsapp: string;
}

export interface MessengerProfile {
  id: string;
  userId: string;
  vehicle: MessengerVehicle;
  serviceAreas: string[];
  status: MessengerProfileStatus;
  activeSince: string | null;
  /** Fin de la suscripción; null si nunca se activó. */
  expiresAt: string | null;
  daysLeft: number;
  subscriptionActive: boolean;
  createdAt: string;
}

export interface MessengerPayment {
  id: string;
  amountCup: number;
  status: MessengerPaymentStatus;
  method: MessengerPaymentMethod;
  kind: MessengerPaymentKind;
  coversDays: number | null;
  reference: string | null;
  evidenceNote: string | null;
  createdAt: string;
}

export interface MessengerApplicationData {
  platform: MessengerPlatformConfig;
  profile: MessengerProfile | null;
  payments: MessengerPayment[];
  /** Puede pedir el alta inicial. */
  applicationOpen: boolean;
  /** Puede pagar una renovación (perfil ACTIVE y sin pago pendiente). */
  renewalOpen: boolean;
  pendingPayment: MessengerPayment | null;
  subscriptionActive: boolean;
  daysLeft: number;
  expiresAt: string | null;
  isMessenger: boolean;
}

export interface MessengerApplicationInput {
  vehicle: MessengerVehicle;
  serviceAreas: string[];
  reference: string;
  method: MessengerPaymentMethod;
}

export interface UseMessengerApplicationOptions {
  isOpen: boolean;
  user: { id: string; role?: AuthRole | string } | null;
  onRoleChange?: () => Promise<void> | void;
}

export interface UseMessengerApplicationState {
  data: MessengerApplicationData | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  submit: (input: MessengerApplicationInput) => Promise<boolean>;
}

/** Aviso cuando quedan pocos días, para que nadie se quede sin servicio de golpe. */
export const DIAS_AVISO_RENOVACION = 7;

interface ApplicationResponse {
  success?: boolean;
  platform?: MessengerPlatformConfig;
  profile?: MessengerProfile | null;
  payments?: MessengerPayment[];
  payment?: MessengerPayment;
  applicationOpen?: boolean;
  renewalOpen?: boolean;
  pendingPayment?: MessengerPayment | null;
  subscriptionActive?: boolean;
  daysLeft?: number;
  expiresAt?: string | null;
  kind?: MessengerPaymentKind;
  isMessenger?: boolean;
  error?: string;
}

/**
 * El cuerpo ya viene leído por quien llama: `Response.json()` consume el
 * stream y una segunda lectura lanza, de modo que el mensaje real del servidor
 * se perdía y siempre se mostraba el texto genérico.
 */
function readError(body: ApplicationResponse | null, fallback: string): string {
  return body?.error ?? fallback;
}

export function useMessengerApplication({
  isOpen,
  user,
  onRoleChange
}: UseMessengerApplicationOptions): UseMessengerApplicationState {
  const { showToast } = useToast();
  const [data, setData] = useState<MessengerApplicationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isOpen || !user) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/messenger/apply', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as ApplicationResponse | null;
      if (!res.ok || !body?.success || !body.platform) {
        throw new Error(readError(body, 'No se pudo cargar la solicitud'));
      }
      const nextData: MessengerApplicationData = {
        platform: body.platform,
        profile: body.profile ?? null,
        payments: body.payments ?? [],
        applicationOpen: body.applicationOpen ?? (body.profile?.status !== 'ACTIVE'),
        renewalOpen: body.renewalOpen ?? false,
        pendingPayment: body.pendingPayment ?? null,
        subscriptionActive: body.subscriptionActive ?? false,
        daysLeft: body.daysLeft ?? 0,
        expiresAt: body.expiresAt ?? null,
        isMessenger: body.isMessenger ?? user.role === 'MESSENGER'
      };
      setData(nextData);
      if (
        nextData.profile?.status === 'ACTIVE' &&
        nextData.isMessenger === false &&
        user.role !== 'MESSENGER'
      ) {
        await onRoleChange?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la solicitud');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, onRoleChange, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const submit = useCallback(
    async (input: MessengerApplicationInput) => {
      if (!user || isSubmitting) return false;
      setIsSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/messenger/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        const body = (await res.json().catch(() => null)) as ApplicationResponse | null;
        if (!res.ok || !body?.success) {
          const message = readError(body, 'No se pudo enviar la solicitud');
          setError(message);
          showToast(message);
          return false;
        }
        showToast(
          body.kind === 'renovacion'
            ? 'Renovación enviada. El administrador revisará tu pago.'
            : 'Solicitud enviada. El administrador revisará tu pago.'
        );
        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo enviar la solicitud';
        setError(message);
        showToast(message);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, refresh, showToast, user]
  );

  return { data, isLoading, isSubmitting, error, refresh, submit };
}
