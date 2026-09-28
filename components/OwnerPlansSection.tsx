'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clock, Loader2, Sparkles } from 'lucide-react';

/**
 * Planes vistos por el dueño.
 *
 * Pedir un plan NO lo activa: deja un pago que confirma un administrador. La
 * pantalla lo dice con esas palabras, porque prometer lo contrario sería
 * cobrar expectativas que el producto no cumple todavía.
 */

interface PlanDTO {
  code: string;
  name: string;
  scope: 'ACCOUNT' | 'BUSINESS';
  priceCup: number;
  periodDays: number;
  features: string[];
}

interface SubscriptionDTO {
  id: string;
  planCode: string;
  planName: string;
  businessName: string | null;
  status: string;
  daysLeft: number | null;
}

interface NegocioPropio {
  id: string;
  name: string;
  ownership: string;
}

const ETIQUETA_FUNCION: Record<string, string> = {
  featured: 'Destacar en el mapa',
  stats: 'Estadísticas de visitas',
  photos: 'Más fotos'
};

function estadoLegible(estado: string, diasRestantes: number | null): string {
  if (estado === 'ACTIVE') {
    if (diasRestantes === null) return 'Activo';
    if (diasRestantes <= 0) return 'Vencido';
    return diasRestantes === 1 ? 'Queda 1 día' : `Quedan ${diasRestantes} días`;
  }
  if (estado === 'PENDING') return 'Esperando confirmación del pago';
  if (estado === 'EXPIRED') return 'Vencido';
  return 'Rechazado';
}

export default function OwnerPlansSection({ negocios }: { negocios: NegocioPropio[] }) {
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [suscripciones, setSuscripciones] = useState<SubscriptionDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [negocioElegido, setNegocioElegido] = useState('');
  const [enviando, setEnviando] = useState(false);

  const propios = negocios.filter((n) => n.ownership === 'CONFIRMED');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [rp, rs] = await Promise.all([
        fetch('/api/plans', { cache: 'no-store' }),
        fetch('/api/account/subscriptions', { cache: 'no-store' })
      ]);
      const bp = (await rp.json()) as { success?: boolean; plans?: PlanDTO[]; error?: string };
      const bs = (await rs.json()) as {
        success?: boolean;
        subscriptions?: SubscriptionDTO[];
        error?: string;
      };
      if (!rp.ok || !bp.success) throw new Error(bp.error ?? 'No se pudieron cargar los planes');
      if (!rs.ok || !bs.success) throw new Error(bs.error ?? 'No se pudieron cargar tus planes');
      setPlanes(bp.plans ?? []);
      setSuscripciones(bs.subscriptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los planes');
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

  const pedir = async (plan: PlanDTO) => {
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/plans/${plan.code}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: metodo,
          reference: referencia.trim() || undefined,
          businessId: plan.scope === 'BUSINESS' ? negocioElegido : undefined
        })
      });
      const body = (await res.json()) as {
        success?: boolean;
        error?: string;
        payment?: { amountCup: number };
      };
      if (!res.ok || !body.success) throw new Error(body.error ?? 'No se pudo pedir el plan');
      setAviso(
        `Pedido por $${Math.round(body.payment?.amountCup ?? plan.priceCup)} CUP. ` +
          'Un administrador confirmará el pago.'
      );
      setAbierto(null);
      setReferencia('');
      setNegocioElegido('');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pedir el plan');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="space-y-2 border-t border-border-subtle pt-4">
      <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-display">
        Planes
      </h3>

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
        <div role="status" className="flex items-center gap-2 py-6 justify-center text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Cargando planes…
        </div>
      ) : (
        <>
          {suscripciones.length > 0 && (
            <ul className="space-y-1.5">
              {suscripciones.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-border-subtle p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-primary truncate">
                      {s.planName}
                      {s.businessName && <span className="text-slate-400"> · {s.businessName}</span>}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {estadoLegible(s.status, s.daysLeft)}
                    </p>
                  </div>
                  {s.status === 'ACTIVE' ? (
                    <BadgeCheck className="w-4 h-4 text-emerald-brand flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock className="w-4 h-4 text-saffron flex-shrink-0" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          )}

          {propios.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-border-subtle rounded-xl p-3">
              Los planes se contratan sobre negocios que ya son tuyos. Reclama uno primero.
            </p>
          ) : (
            planes.map((plan) => {
              const desplegado = abierto === plan.code;
              const faltaNegocio = plan.scope === 'BUSINESS' && !negocioElegido;
              return (
                <div key={plan.code} className="rounded-xl border border-border-subtle p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-text-primary font-display">
                        {plan.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {plan.scope === 'ACCOUNT'
                          ? 'Cubre todos tus negocios'
                          : 'Cubre un solo negocio'}
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-emerald-brand flex-shrink-0">
                      ${Math.round(plan.priceCup)}
                      <span className="text-[10px] font-bold text-slate-500"> /{plan.periodDays}d</span>
                    </p>
                  </div>

                  <ul className="flex flex-wrap gap-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="text-[10px] font-bold text-cerulean-dark bg-tm-bg border border-tm-border px-2 py-0.5 rounded-full"
                      >
                        {ETIQUETA_FUNCION[f] ?? f}
                      </li>
                    ))}
                  </ul>

                  {!desplegado ? (
                    <button
                      onClick={() => setAbierto(plan.code)}
                      className="w-full min-h-11 px-4 rounded-xl bg-emerald-brand hover:bg-mint text-white text-xs font-extrabold transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      Pedir este plan
                    </button>
                  ) : (
                    <div className="space-y-2 border-t border-border-subtle pt-2">
                      {plan.scope === 'BUSINESS' && (
                        <label className="block space-y-1">
                          <span className="text-[11px] font-bold text-slate-600">Negocio</span>
                          <select
                            value={negocioElegido}
                            onChange={(e) => setNegocioElegido(e.target.value)}
                            className="w-full text-sm px-3 min-h-11 rounded-lg border border-border-subtle bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                          >
                            <option value="">Elige uno…</option>
                            {propios.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      <fieldset className="space-y-1">
                        <legend className="text-[11px] font-bold text-slate-600">Cómo pagas</legend>
                        <div className="flex gap-2">
                          {(['efectivo', 'transferencia'] as const).map((m) => (
                            <label
                              key={m}
                              className="flex-1 min-h-11 px-3 rounded-lg border border-border-subtle bg-white flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer has-[:checked]:border-emerald-brand has-[:checked]:text-emerald-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-900"
                            >
                              <input
                                type="radio"
                                name={`metodo-${plan.code}`}
                                value={m}
                                checked={metodo === m}
                                onChange={() => setMetodo(m)}
                                className="sr-only"
                              />
                              {m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      {metodo === 'transferencia' && (
                        <label className="block space-y-1">
                          <span className="text-[11px] font-bold text-slate-600">
                            Referencia de la transferencia
                          </span>
                          <input
                            type="text"
                            value={referencia}
                            onChange={(e) => setReferencia(e.target.value.slice(0, 80))}
                            placeholder="ej. TM-90210"
                            className="w-full text-sm px-3 min-h-11 rounded-lg border border-border-subtle bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </label>
                      )}

                      <p className="text-[10px] text-slate-500">
                        Pedirlo no lo activa: un administrador confirmará el pago.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => void pedir(plan)}
                          disabled={enviando || faltaNegocio}
                          className="flex-1 min-h-11 px-4 rounded-xl bg-emerald-brand hover:bg-mint text-white text-xs font-extrabold disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          {enviando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                          Confirmar pedido
                        </button>
                        <button
                          onClick={() => setAbierto(null)}
                          className="flex-1 min-h-11 px-4 rounded-xl border border-border-subtle bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </section>
  );
}
