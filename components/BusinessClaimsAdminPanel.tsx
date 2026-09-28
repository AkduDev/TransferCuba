'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  ShieldQuestion,
  User,
  XCircle
} from 'lucide-react';

/**
 * Cola de solicitudes de propiedad.
 *
 * Confirmar aquí no es un trámite: entrega el negocio a esa persona y descarta
 * las demás solicitudes sobre él. Por eso la tarjeta enseña el teléfono y lo
 * que aportó como evidencia — el administrador tiene que poder comprobarlo
 * antes de pulsar, no después.
 */

interface ClaimDTO {
  id: string;
  businessId: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  evidence: string | null;
  createdAt: string;
  business?: { name: string; status: string; province: string; municipality: string };
  claimant?: { id: string; name: string; phone: string };
}

function haceCuanto(valor: string): string {
  const minutos = Math.max(1, Math.round((Date.now() - new Date(valor).getTime()) / 60000));
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 1440) return `hace ${Math.floor(minutos / 60)} h`;
  return `hace ${Math.floor(minutos / 1440)} d`;
}

function estadoDelNegocio(estado: string | undefined): string {
  if (estado === 'active') return 'Publicado';
  if (estado === 'pending') return 'Pendiente de aprobación';
  return 'Rechazado';
}

export default function BusinessClaimsAdminPanel() {
  const [claims, setClaims] = useState<ClaimDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/business-claims', { cache: 'no-store' });
      const body = (await res.json()) as { success?: boolean; claims?: ClaimDTO[]; error?: string };
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? 'No se pudieron cargar las solicitudes');
      }
      setClaims(body.claims ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cola');
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

  const resolver = async (claim: ClaimDTO, action: 'confirm' | 'reject') => {
    setEnCurso(claim.id);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/admin/business-claims/${claim.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? 'No se pudo procesar la solicitud');
      }
      setClaims((previas) => previas.filter((c) => c.id !== claim.id));
      setAviso(
        action === 'confirm'
          ? `${claim.business?.name ?? 'El negocio'} es ahora de ${claim.claimant?.name ?? 'esa persona'}`
          : 'Solicitud rechazada'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud');
    } finally {
      setEnCurso(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50/50 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-text-primary font-display flex items-center gap-2">
            <ShieldQuestion className="w-4 h-4 text-cerulean-dark flex-shrink-0" />
            Solicitudes de propiedad
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Confirmar entrega el negocio y descarta las demás solicitudes sobre él.
          </p>
        </div>
        <button
          onClick={() => void cargar()}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-border-subtle bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
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
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando solicitudes…
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-lg border border-border-subtle space-y-2">
          <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <BadgeCheck className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-text-primary font-display">No hay solicitudes pendientes</p>
          <p className="text-xs text-slate-500">
            Aparecerán aquí cuando alguien reclame un negocio desde su cuenta.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {claims.map((claim) => {
            const ocupado = enCurso === claim.id;
            return (
              <li
                key={claim.id}
                className="bg-white rounded-xl border border-border-subtle p-3 sm:p-4 shadow-level-1 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-extrabold text-text-primary font-display flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{claim.business?.name ?? claim.businessId}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {claim.business?.municipality}, {claim.business?.province}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{estadoDelNegocio(claim.business?.status)}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full flex-shrink-0 self-start">
                    <Clock className="w-3 h-3" />
                    {haceCuanto(claim.createdAt)}
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 border border-border-subtle p-2.5 space-y-1.5">
                  <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{claim.claimant?.name ?? '—'}</span>
                  </p>
                  <a
                    href={`tel:${claim.claimant?.phone ?? ''}`}
                    className="text-xs text-cerulean-dark font-bold inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 sm:py-0"
                  >
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    {claim.claimant?.phone ?? '—'}
                  </a>
                  {claim.evidence && (
                    <p className="text-[11px] text-slate-600 leading-snug break-words">
                      <span className="font-bold text-slate-500">Dice: </span>
                      {claim.evidence}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => void resolver(claim, 'confirm')}
                    disabled={ocupado}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-emerald-brand hover:bg-mint text-white text-xs font-bold disabled:opacity-60 transition-colors"
                  >
                    {ocupado ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Confirmar dueño
                  </button>
                  <button
                    onClick={() => void resolver(claim, 'reject')}
                    disabled={ocupado}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-border-subtle bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold disabled:opacity-60 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
