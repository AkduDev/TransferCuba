'use client';

import { useState } from 'react';
import { BarChart3, Loader2, Lock } from 'lucide-react';

/**
 * Visitas de un negocio, para su dueño.
 *
 * Se piden a mano y no al abrir el modal: son una consulta por negocio, y
 * lanzarlas todas de golpe castigaría una conexión lenta para enseñar algo que
 * puede que no se mire.
 *
 * Se llaman "aperturas de ficha" y no "visitantes", porque no se guarda nada de
 * quien mira y ese es exactamente el dato que hay.
 */
export default function BusinessViewsStat({ businessId }: { businessId: string }) {
  const [estado, setEstado] = useState<'inicio' | 'cargando' | 'listo' | 'bloqueado' | 'error'>(
    'inicio'
  );
  const [total, setTotal] = useState(0);
  const [ultimos7, setUltimos7] = useState(0);
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    setEstado('cargando');
    try {
      const res = await fetch(`/api/businesses/${businessId}/stats`, { cache: 'no-store' });
      if (res.status === 402) {
        const body = (await res.json()) as { error?: string };
        setMensaje(body.error ?? 'Disponible con la cuenta premium');
        setEstado('bloqueado');
        return;
      }
      const body = (await res.json()) as {
        success?: boolean;
        total?: number;
        series?: { day: string; views: number }[];
        error?: string;
      };
      if (!res.ok || !body.success) throw new Error(body.error ?? 'No se pudieron cargar');
      setTotal(body.total ?? 0);
      setUltimos7((body.series ?? []).slice(-7).reduce((s, d) => s + d.views, 0));
      setEstado('listo');
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudieron cargar');
      setEstado('error');
    }
  };

  if (estado === 'listo') {
    return (
      <p className="text-[11px] text-slate-600 mt-1">
        <span className="font-extrabold text-text-primary">{total}</span> aperturas en 30 días
        <span className="text-slate-400"> · {ultimos7} en los últimos 7</span>
      </p>
    );
  }

  if (estado === 'bloqueado') {
    return (
      <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
        <Lock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {mensaje}
      </p>
    );
  }

  if (estado === 'error') {
    return <p className="text-[11px] text-crimson mt-1">{mensaje}</p>;
  }

  return (
    <button
      onClick={() => void cargar()}
      disabled={estado === 'cargando'}
      className="text-[11px] font-bold text-cerulean-dark inline-flex items-center gap-1 min-h-11 sm:min-h-0 sm:mt-1 disabled:opacity-60"
    >
      {estado === 'cargando' ? (
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
      ) : (
        <BarChart3 className="w-3 h-3" aria-hidden="true" />
      )}
      Ver visitas
    </button>
  );
}
