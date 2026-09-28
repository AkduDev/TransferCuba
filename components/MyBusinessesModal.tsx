'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Search,
  Store,
  User,
  X
} from 'lucide-react';
import ModalShell from '@/components/ModalShell';

/**
 * La casa del dueño de negocio.
 *
 * Publicar es gratis y anónimo, así que un negocio recién registrado no
 * pertenece a nadie: aquí se pide esa propiedad y se ve en qué estado está.
 * Reclamar NO da la propiedad — la confirma un administrador a mano — y la
 * pantalla lo dice con esas palabras para no prometer lo que no hace.
 *
 * Es también el sitio donde vivirán las funciones premium cuando existan.
 */

interface OwnedBusiness {
  id: string;
  name: string;
  status: string;
  province: string;
  municipality: string;
  ownership: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}

interface Candidato {
  id: string;
  name: string;
  province: string;
  municipality: string;
}

interface MyBusinessesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string } | null;
  onOpenAuth: () => void;
}

const EVIDENCIA_MAX = 500;

function etiquetaDeEstado(status: string): string {
  if (status === 'active') return 'Publicado';
  if (status === 'pending') return 'Pendiente de aprobación';
  return 'Rechazado';
}

export default function MyBusinessesModal({
  isOpen,
  onClose,
  user,
  onOpenAuth
}: MyBusinessesModalProps) {
  const [mios, setMios] = useState<OwnedBusiness[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscoAlgunaVez, setBuscoAlgunaVez] = useState(false);
  const [elegido, setElegido] = useState<Candidato | null>(null);
  const [evidencia, setEvidencia] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/account/businesses', { cache: 'no-store' });
      const body = (await res.json()) as {
        success?: boolean;
        businesses?: OwnedBusiness[];
        error?: string;
      };
      if (!res.ok || !body.success) throw new Error(body.error ?? 'No se pudieron cargar tus negocios');
      setMios(body.businesses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar tus negocios');
    } finally {
      setCargando(false);
    }
  }, []);

  // Por `id` y no por el objeto `user`: `useAuth` lo recrea en cada render, y
  // con el objeto como dependencia el efecto se relanza sin parar — una
  // tormenta de peticiones que además deja el panel en "Cargando…" para siempre.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!isOpen || !userId) return;
    const t = setTimeout(() => {
      void cargar();
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen, userId, cargar]);

  /**
   * La búsqueda se lanza a mano, no al teclear.
   *
   * Un debounce con guarda de carrera tenía demasiadas piezas para lo que
   * aporta, y en una conexión lenta es mejor que sea la persona quien decida
   * cuándo gastar una petición en vez de dispararla en cada pausa al escribir.
   */
  const buscar = async () => {
    const limpio = busqueda.trim();
    if (limpio.length < 3) {
      setCandidatos([]);
      setBuscoAlgunaVez(true);
      return;
    }
    setBuscando(true);
    setBuscoAlgunaVez(true);
    try {
      const res = await fetch(`/api/businesses?q=${encodeURIComponent(limpio)}&limit=8`, {
        cache: 'no-store'
      });
      const body = (await res.json()) as { businesses?: Candidato[] };
      setCandidatos(body.businesses ?? []);
    } catch {
      setCandidatos([]);
    } finally {
      setBuscando(false);
    }
  };

  const yaLoTengo = (id: string) => mios.some((m) => m.id === id);

  const reclamar = async () => {
    if (!elegido) return;
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/businesses/${elegido.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence: evidencia.trim() || undefined })
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) throw new Error(body.error ?? 'No se pudo enviar la solicitud');
      setAviso('Solicitud enviada. Un administrador la revisará.');
      setElegido(null);
      setEvidencia('');
      setBusqueda('');
      setCandidatos([]);
      setBuscoAlgunaVez(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="mis-negocios-title"
      describedBy="mis-negocios-subtitle"
      overlayClassName="z-[60] p-3 sm:p-5"
      panelClassName="w-full max-w-lg max-h-[90dvh] bg-white rounded-2xl shadow-level-4 flex flex-col overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border-subtle">
        <div className="min-w-0">
          <h2 id="mis-negocios-title" className="text-base font-extrabold text-text-primary font-display flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-brand flex-shrink-0" aria-hidden="true" />
            Mis negocios
          </h2>
          <p id="mis-negocios-subtitle" className="text-[11px] text-slate-500 mt-0.5">
            Publicar es gratis. Ser el dueño lo confirma un administrador.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-cerulean/10 border border-cerulean/20 text-cerulean flex items-center justify-center">
            <User className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <p className="font-extrabold text-slate-800">Inicia sesión para gestionar tus negocios</p>
            <p className="text-xs text-slate-500 mt-1">
              Necesitas una cuenta para reclamar un negocio como tuyo.
            </p>
          </div>
          <button
            onClick={onOpenAuth}
            className="min-h-11 px-4 rounded-lg bg-emerald-brand text-white text-xs font-extrabold hover:bg-mint transition-colors"
          >
            Iniciar sesión o registrarse
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-ez-bg/50 border border-ez-border text-xs text-crimson flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {aviso && (
            <div role="status" className="p-3 rounded-xl bg-emerald-brand/10 border border-emerald-brand/30 text-xs font-bold text-emerald-brand">
              {aviso}
            </div>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-display">
              Tus negocios
            </h3>
            {cargando ? (
              <div role="status" className="flex items-center gap-2 py-8 justify-center text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Cargando…
              </div>
            ) : mios.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-border-subtle rounded-xl p-3">
                Todavía no tienes ninguno. Si tu negocio ya está en el mapa, búscalo abajo y
                reclámalo.
              </p>
            ) : (
              <ul className="space-y-2">
                {mios.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl border border-border-subtle p-3 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{n.name}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {n.municipality}, {n.province}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{etiquetaDeEstado(n.status)}</p>
                    </div>
                    {n.ownership === 'CONFIRMED' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-brand bg-emerald-brand/10 border border-emerald-brand/30 px-2 py-1 rounded-full flex-shrink-0">
                        <BadgeCheck className="w-3 h-3" aria-hidden="true" /> Tuyo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-saffron bg-saffron/10 border border-saffron/30 px-2 py-1 rounded-full flex-shrink-0">
                        <Clock className="w-3 h-3" aria-hidden="true" /> En revisión
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 border-t border-border-subtle pt-4">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-display">
              Reclamar un negocio
            </h3>
            <p className="text-[11px] text-slate-500">
              Búscalo por su nombre. Un administrador comprobará que es tuyo antes de
              entregártelo.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void buscar();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <label className="flex-1 block">
                <span className="sr-only">Buscar un negocio por nombre</span>
                <span className="relative block">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      setElegido(null);
                    }}
                    placeholder="ej. La Esquina Market"
                    className="w-full text-sm pl-9 pr-3 min-h-11 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
                  />
                </span>
              </label>
              <button
                type="submit"
                disabled={buscando || busqueda.trim().length < 3}
                className="min-h-11 px-4 rounded-lg bg-navy hover:bg-slate-800 text-white text-xs font-extrabold disabled:opacity-50 transition-colors flex-shrink-0"
              >
                Buscar
              </button>
            </form>

            {buscando && (
              <p role="status" className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Buscando…
              </p>
            )}

            {!elegido && candidatos.length > 0 && (
              <ul className="space-y-1.5">
                {candidatos.map((c) => {
                  const propio = yaLoTengo(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setElegido(c)}
                        disabled={propio}
                        className="w-full text-left min-h-11 px-3 py-2 rounded-lg border border-border-subtle hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                      >
                        <span className="block text-sm font-bold text-text-primary truncate">
                          {c.name}
                        </span>
                        <span className="block text-[11px] text-slate-500 truncate">
                          {c.municipality}, {c.province}
                          {propio && ' · ya es tuyo o está en revisión'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {!elegido && buscoAlgunaVez && !buscando && candidatos.length === 0 && (
              <p className="text-[11px] text-slate-500">
                No encontramos ninguno con ese nombre. Solo aparecen los ya publicados.
              </p>
            )}

            {elegido && (
              <div className="rounded-xl border border-emerald-brand/30 bg-emerald-brand/5 p-3 space-y-3">
                <p className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{elegido.name}</span>
                </p>

                <label className="block space-y-1">
                  <span className="text-[11px] font-bold text-slate-600">
                    ¿Cómo podemos comprobar que es tuyo? <span className="font-normal text-slate-400">(opcional)</span>
                  </span>
                  <textarea
                    value={evidencia}
                    onChange={(e) => setEvidencia(e.target.value.slice(0, EVIDENCIA_MAX))}
                    rows={3}
                    placeholder="ej. El teléfono del local es el mío, o puedo enviar una factura"
                    className="w-full text-sm p-2.5 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white resize-none"
                  />
                  <span className="block text-[10px] text-slate-400 text-right">
                    {evidencia.length}/{EVIDENCIA_MAX}
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => void reclamar()}
                    disabled={enviando}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl bg-emerald-brand hover:bg-mint text-white text-xs font-extrabold disabled:opacity-60 transition-colors"
                  >
                    {enviando ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    )}
                    Enviar solicitud
                  </button>
                  <button
                    onClick={() => setElegido(null)}
                    className="flex-1 min-h-11 px-4 rounded-xl border border-border-subtle bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors"
                  >
                    Elegir otro
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </ModalShell>
  );
}
