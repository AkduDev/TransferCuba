'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Phone,
  RefreshCw,
  User,
  Wallet,
  XCircle
} from 'lucide-react';

/**
 * Planes de pago: precios y cola de cobros.
 *
 * Cambiar un precio aquí NO altera lo ya pedido: el importe y el periodo se
 * congelaron en la fila del pago al solicitarlo. Eso se dice en pantalla, para
 * que el administrador sepa qué está tocando.
 */

interface PlanDTO {
  code: string;
  name: string;
  scope: 'ACCOUNT' | 'BUSINESS';
  priceCup: number;
  periodDays: number;
  features: string[];
  active: boolean;
}

interface PaymentDTO {
  id: string;
  amountCup: number;
  periodDays: number;
  method: string;
  kind: string;
  reference: string | null;
  createdAt: string;
  plan?: { code: string; name: string; scope: string };
  business?: { id: string; name: string | null };
  payer?: { id: string; name: string; phone: string };
}

const ETIQUETA_FUNCION: Record<string, string> = {
  featured: 'Destacar en el mapa',
  stats: 'Estadísticas de visitas',
  photos: 'Más fotos'
};

function haceCuanto(valor: string): string {
  const minutos = Math.max(1, Math.round((Date.now() - new Date(valor).getTime()) / 60000));
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 1440) return `hace ${Math.floor(minutos / 60)} h`;
  return `hace ${Math.floor(minutos / 1440)} d`;
}

export default function PlansAdminPanel() {
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [pagos, setPagos] = useState<PaymentDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Record<string, { precio: string; dias: string }>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [rp, rg] = await Promise.all([
        fetch('/api/admin/plans', { cache: 'no-store' }),
        fetch('/api/admin/plan-payments', { cache: 'no-store' })
      ]);
      const bp = (await rp.json()) as { success?: boolean; plans?: PlanDTO[]; error?: string };
      const bg = (await rg.json()) as { success?: boolean; payments?: PaymentDTO[]; error?: string };
      if (!rp.ok || !bp.success) throw new Error(bp.error ?? 'No se pudieron cargar los planes');
      if (!rg.ok || !bg.success) throw new Error(bg.error ?? 'No se pudieron cargar los pagos');
      setPlanes(bp.plans ?? []);
      setPagos(bg.payments ?? []);
      setBorrador(
        Object.fromEntries(
          (bp.plans ?? []).map((p) => [
            p.code,
            { precio: String(p.priceCup), dias: String(p.periodDays) }
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void cargar();
    }, 0);
    return () => clearTimeout(t);
  }, [cargar]);

  const guardarPlan = async (plan: PlanDTO) => {
    const campos = borrador[plan.code];
    if (!campos) return;
    setGuardando(plan.code);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/admin/plans/${plan.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceCup: Number(campos.precio), periodDays: Number(campos.dias) })
      });
      const body = (await res.json()) as { success?: boolean; plan?: PlanDTO; error?: string };
      if (!res.ok || !body.success || !body.plan) {
        throw new Error(body.error ?? 'No se pudo guardar el plan');
      }
      setPlanes((previos) => previos.map((p) => (p.code === plan.code ? body.plan! : p)));
      setAviso(`${body.plan.name}: $${body.plan.priceCup} CUP por ${body.plan.periodDays} días`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el plan');
    } finally {
      setGuardando(null);
    }
  };

  const resolverPago = async (pago: PaymentDTO, action: 'confirm' | 'reject') => {
    setEnCurso(pago.id);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/admin/plan-payments/${pago.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) throw new Error(body.error ?? 'No se pudo procesar el pago');
      setPagos((previos) => previos.filter((p) => p.id !== pago.id));
      setAviso(action === 'confirm' ? 'Pago confirmado y plan activado' : 'Pago rechazado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el pago');
    } finally {
      setEnCurso(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50/50 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-text-primary font-display flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4 text-emerald-brand flex-shrink-0" aria-hidden="true" />
            Planes y cobros
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Cambiar un precio no altera lo ya pedido: cada pago congeló su importe.
          </p>
        </div>
        <button
          onClick={() => void cargar()}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-border-subtle bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-ez-bg/50 border border-ez-border text-xs text-crimson">
          {error}
        </div>
      )}
      {aviso && (
        <div role="status" className="p-3 rounded-xl bg-emerald-brand/10 border border-emerald-brand/30 text-xs font-bold text-emerald-brand">
          {aviso}
        </div>
      )}

      {cargando ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Cargando…
        </div>
      ) : (
        <>
          <section className="space-y-2.5">
            <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-display">
              Precios
            </h4>
            {planes.map((plan) => (
              <div
                key={plan.code}
                className="bg-white rounded-xl border border-border-subtle p-3 sm:p-4 shadow-level-1 space-y-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-text-primary font-display">{plan.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {plan.scope === 'ACCOUNT'
                      ? 'Cubre todos los negocios del dueño'
                      : 'Cubre un solo negocio'}
                  </p>
                  <ul className="flex flex-wrap gap-1 mt-1.5">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="text-[10px] font-bold text-cerulean-dark bg-tm-bg border border-tm-border px-2 py-0.5 rounded-full"
                      >
                        {ETIQUETA_FUNCION[f] ?? f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <label className="flex-1 block space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">Precio (CUP)</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={borrador[plan.code]?.precio ?? ''}
                      onChange={(e) =>
                        setBorrador((b) => ({
                          ...b,
                          [plan.code]: { ...b[plan.code], precio: e.target.value }
                        }))
                      }
                      className="w-full text-sm px-3 min-h-11 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
                    />
                  </label>
                  <label className="flex-1 block space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">Vigencia (días)</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      step={1}
                      value={borrador[plan.code]?.dias ?? ''}
                      onChange={(e) =>
                        setBorrador((b) => ({
                          ...b,
                          [plan.code]: { ...b[plan.code], dias: e.target.value }
                        }))
                      }
                      className="w-full text-sm px-3 min-h-11 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
                    />
                  </label>
                  <button
                    onClick={() => void guardarPlan(plan)}
                    disabled={guardando === plan.code}
                    className="min-h-11 px-4 rounded-xl bg-navy hover:bg-slate-800 text-white text-xs font-extrabold disabled:opacity-60 transition-colors flex-shrink-0"
                  >
                    {guardando === plan.code ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2.5 border-t border-border-subtle pt-4">
            <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-display">
              Pagos por confirmar
            </h4>
            {pagos.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white rounded-lg border border-border-subtle space-y-2">
                <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Wallet className="w-6 h-6" aria-hidden="true" />
                </div>
                <p className="text-sm font-bold text-text-primary font-display">No hay pagos pendientes</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {pagos.map((pago) => {
                  const ocupado = enCurso === pago.id;
                  return (
                    <li
                      key={pago.id}
                      className="bg-white rounded-xl border border-border-subtle p-3 sm:p-4 shadow-level-1 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-text-primary font-display">
                            {pago.plan?.name ?? pago.plan?.code}
                            <span className="ml-1.5 text-[10px] font-bold text-slate-500 uppercase">
                              {pago.kind}
                            </span>
                          </p>
                          {pago.business && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate">{pago.business.name}</span>
                            </p>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full flex-shrink-0 self-start">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {haceCuanto(pago.createdAt)}
                        </span>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-border-subtle p-2.5 space-y-1.5">
                        <p className="text-sm font-extrabold text-emerald-brand">
                          ${Math.round(pago.amountCup)} CUP
                          <span className="text-[11px] font-bold text-slate-500 ml-1.5">
                            por {pago.periodDays} días
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                          {pago.method === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                          {pago.reference && <span className="font-mono">· {pago.reference}</span>}
                        </p>
                        <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">{pago.payer?.name ?? '—'}</span>
                        </p>
                        <a
                          href={`tel:${pago.payer?.phone ?? ''}`}
                          className="text-xs text-cerulean-dark font-bold inline-flex items-center gap-1.5 min-h-11 sm:min-h-0"
                        >
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                          {pago.payer?.phone ?? '—'}
                        </a>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => void resolverPago(pago, 'confirm')}
                          disabled={ocupado}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-xl bg-emerald-brand hover:bg-mint text-white text-xs font-bold disabled:opacity-60 transition-colors"
                        >
                          {ocupado ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          )}
                          Confirmar pago
                        </button>
                        <button
                          onClick={() => void resolverPago(pago, 'reject')}
                          disabled={ocupado}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-xl border border-border-subtle bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold disabled:opacity-60 transition-colors"
                        >
                          <XCircle className="w-4 h-4" aria-hidden="true" />
                          Rechazar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
