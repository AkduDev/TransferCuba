'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle
} from 'lucide-react';
import type {
  MessengerPaymentStatus,
  MessengerPlatformConfig,
  MessengerProfileStatus
} from '@/lib/hooks/useMessengerApplication';

interface MessengerApplicationDTO {
  id: string;
  userId: string;
  name: string;
  phone: string;
  role: string;
  userStatus: 'active' | 'blocked';
  vehicle: string;
  serviceAreas: string[];
  profileStatus: MessengerProfileStatus;
  profileCreatedAt: string;
  paymentId: string | null;
  paymentAmountCup: number | null;
  paymentStatus: MessengerPaymentStatus | null;
  paymentReference: string | null;
  paymentCreatedAt: string | null;
}

function cup(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `$${Math.round(value)} CUP`;
}

function timeAgo(value: string | null | undefined): string {
  if (!value) return '—';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} h`;
  return `hace ${Math.floor(minutes / 1440)} d`;
}

function statusLabel(status: MessengerProfileStatus | null | undefined): string {
  if (status === 'ACTIVE') return 'Activo';
  if (status === 'SUSPENDED') return 'Suspendido';
  return 'Pendiente';
}

function paymentLabel(status: MessengerPaymentStatus | null | undefined): string {
  if (status === 'CONFIRMED') return 'Confirmado';
  if (status === 'REJECTED') return 'Rechazado';
  if (status === 'PAID') return 'Reportado';
  return 'Pendiente';
}

export default function MessengerAdminPanel() {
  const [platform, setPlatform] = useState<MessengerPlatformConfig | null>(null);
  const [applications, setApplications] = useState<MessengerApplicationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<{ messengerFeeCup: string; messengerPayCard: string; messengerWhatsapp: string }>({
    messengerFeeCup: '',
    messengerPayCard: '',
    messengerWhatsapp: ''
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [platformRes, applicationsRes] = await Promise.all([
        fetch('/api/admin/platform', { cache: 'no-store' }),
        fetch('/api/admin/messengers?status=PENDING', { cache: 'no-store' })
      ]);
      const platformBody = (await platformRes.json()) as { success?: boolean; platform?: MessengerPlatformConfig; error?: string };
      const applicationsBody = (await applicationsRes.json()) as { success?: boolean; applications?: MessengerApplicationDTO[]; error?: string };
      if (!platformRes.ok || !platformBody.success || !platformBody.platform) {
        throw new Error(platformBody.error ?? 'No se pudo cargar la configuración');
      }
      if (!applicationsRes.ok || !applicationsBody.success) {
        throw new Error(applicationsBody.error ?? 'No se pudieron cargar las solicitudes');
      }
      setPlatform(platformBody.platform);
      setApplications(applicationsBody.applications ?? []);
      setForm({
        messengerFeeCup: String(platformBody.platform.messengerFeeCup),
        messengerPayCard: platformBody.platform.messengerPayCard,
        messengerWhatsapp: platformBody.platform.messengerWhatsapp
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const savePlatform = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/platform', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messengerFeeCup: Number(form.messengerFeeCup),
          messengerPayCard: form.messengerPayCard,
          messengerWhatsapp: form.messengerWhatsapp
        })
      });
      const body = (await res.json()) as { success?: boolean; error?: string; platform?: MessengerPlatformConfig };
      if (!res.ok || !body.success || !body.platform) throw new Error(body.error ?? 'No se pudo guardar la configuración');
      setPlatform(body.platform);
      setMessage('Configuración guardada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const review = async (userId: string, action: 'confirm' | 'reject') => {
    setActionUserId(userId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/messengers/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) throw new Error(body.error ?? 'No se pudo procesar la solicitud');
      setMessage(action === 'confirm' ? 'Solicitud confirmada' : 'Solicitud rechazada');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud');
    } finally {
      setActionUserId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs font-bold ml-2">Cargando solicitudes...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-3 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cerulean/10 text-cerulean flex items-center justify-center">
              <Bike className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-text-primary font-display">Alta de mensajeros</h3>
              <p className="text-[11px] text-slate-500">Revision de pago y activación de perfiles</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => void load()}
          className="p-2 rounded-lg border border-border-subtle text-slate-500 hover:text-cerulean hover:bg-white transition-colors"
          title="Actualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2.5 text-xs font-bold flex items-start gap-2 ${
          error ? 'bg-ez-bg/40 border-ez-border text-crimson' : 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
        }`}>
          {error ? <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{error ?? message}</span>
        </div>
      )}

      <section className="rounded-lg border border-border-subtle bg-white shadow-xs p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-cerulean" />
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Configuración de alta</h4>
        </div>
        {platform && (
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Costo del alta (CUP)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.messengerFeeCup}
                onChange={(e) => setForm({ ...form, messengerFeeCup: e.target.value })}
                className="w-full rounded-lg border border-border-subtle bg-slate-50 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-900"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Tarjeta o cuenta destino</span>
              <input
                value={form.messengerPayCard}
                onChange={(e) => setForm({ ...form, messengerPayCard: e.target.value })}
                className="w-full rounded-lg border border-border-subtle bg-slate-50 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-900"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">WhatsApp de comprobantes</span>
              <input
                value={form.messengerWhatsapp}
                onChange={(e) => setForm({ ...form, messengerWhatsapp: e.target.value })}
                className="w-full rounded-lg border border-border-subtle bg-slate-50 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-900"
              />
            </label>
          </div>
        )}
        <button
          onClick={() => void savePlatform()}
          disabled={isSaving || !platform}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {isSaving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-saffron" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Solicitudes pendientes</h4>
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-extrabold text-saffron border border-amber-200">
            {applications.length}
          </span>
        </div>

        {applications.length === 0 ? (
          <div className="rounded-lg border border-border-subtle bg-white p-8 text-center text-slate-500">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-extrabold text-text-primary">No hay solicitudes pendientes</p>
            <p className="mt-1 text-xs">Las solicitudes de alta aparecerán aquí para revisión.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((application) => (
              <article key={application.id} className="rounded-lg border border-border-subtle bg-white p-3 sm:p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-cerulean/10 text-cerulean flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="text-sm font-extrabold text-text-primary truncate">{application.name}</h5>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-saffron border border-amber-200">
                          Pendiente
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{application.phone}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                        <span className="inline-flex items-center gap-1"><Bike className="w-3 h-3" /> {application.vehicle}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {application.serviceAreas.join(' · ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-emerald-brand font-display">{cup(application.paymentAmountCup)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(application.paymentCreatedAt)}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-border-subtle p-2.5 grid sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Referencia</p>
                    <p className="font-semibold text-slate-700 mt-0.5 break-words">{application.paymentReference ?? 'Sin referencia'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Perfil</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{statusLabel(application.profileStatus)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pago</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{paymentLabel(application.paymentStatus)}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => void review(application.userId, 'confirm')}
                    disabled={actionUserId !== null}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-brand px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {actionUserId === application.userId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Confirmar alta
                  </button>
                  <button
                    onClick={() => void review(application.userId, 'reject')}
                    disabled={actionUserId !== null}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ez-border bg-ez-bg/40 px-3 py-2 text-xs font-extrabold text-crimson hover:bg-rose-100 disabled:opacity-50 transition-colors"
                  >
                    {actionUserId === application.userId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Rechazar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 rounded-lg border border-cerulean/20 bg-cerulean/5 p-3 text-[11px] text-slate-600">
        <MessageCircle className="w-4 h-4 text-cerulean shrink-0" />
        <span>Los comprobantes se reciben por WhatsApp. Confirma solo después de verificar el pago en la cuenta configurada.</span>
      </div>
    </div>
  );
}
