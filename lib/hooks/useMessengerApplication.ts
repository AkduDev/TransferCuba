'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/lib/hooks/useToast';
import type { AuthRole } from '@/lib/hooks/useAuth';

export type MessengerVehicle = 'pie' | 'bicicleta' | 'moto' | 'auto' | 'otro';
export type MessengerProfileStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type MessengerPaymentStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'REJECTED';

export interface MessengerPlatformConfig {
  messengerFeeCup: number;
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
  createdAt: string;
}

export interface MessengerPayment {
  id: string;
  amountCup: number;
  status: MessengerPaymentStatus;
  reference: string | null;
  evidenceNote: string | null;
  createdAt: string;
}

export interface MessengerApplicationData {
  platform: MessengerPlatformConfig;
  profile: MessengerProfile | null;
  payments: MessengerPayment[];
  applicationOpen: boolean;
  isMessenger: boolean;
}

export interface MessengerApplicationInput {
  vehicle: MessengerVehicle;
  serviceAreas: string[];
  reference: string;
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

interface ApplicationResponse {
  success?: boolean;
  platform?: MessengerPlatformConfig;
  profile?: MessengerProfile | null;
  payments?: MessengerPayment[];
  payment?: MessengerPayment;
  applicationOpen?: boolean;
  isMessenger?: boolean;
  error?: string;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApplicationResponse;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
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
      const body = (await res.json()) as ApplicationResponse;
      if (!res.ok || !body.success || !body.platform) {
        throw new Error(await readError(res, 'No se pudo cargar la solicitud'));
      }
      const nextData: MessengerApplicationData = {
        platform: body.platform,
        profile: body.profile ?? null,
        payments: body.payments ?? [],
        applicationOpen: body.applicationOpen ?? (body.profile?.status !== 'ACTIVE'),
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
        const body = (await res.json()) as ApplicationResponse;
        if (!res.ok || !body.success) {
          const message = await readError(res, 'No se pudo enviar la solicitud');
          setError(message);
          showToast(message);
          return false;
        }
        showToast('Solicitud enviada. El administrador revisará tu pago.');
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
