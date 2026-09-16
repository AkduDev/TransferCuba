'use client';
import React from 'react';
import { CATEGORY_EMOJI, CATEGORIES, Business } from '@/lib/cuba-data';
import type { ClusterInfo } from '@/components/MapLibreMap';
import { ChevronDown, X as XIcon } from 'lucide-react';

interface GoogleMapsClusterCardProps {
  cluster: ClusterInfo;
  visibleCount: number;
  onSelectBusiness: (b: Business) => void;
  onExpand: () => void;
  onClose: () => void;
  onShowMore: () => void;
}

export default function GoogleMapsClusterCard({
  cluster,
  visibleCount,
  onSelectBusiness,
  onExpand,
  onClose,
  onShowMore
}: GoogleMapsClusterCardProps) {
  return (
    <div className="fixed z-40 bottom-40 sm:bottom-44 left-1/2 -translate-x-1/2 w-[min(92vw,420px)] bg-white rounded-2xl border border-border-subtle shadow-level-4 overflow-hidden flex flex-col max-h-[42vh] animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="flex items-center justify-between gap-2 pl-4 pr-2 pt-2.5 pb-2 border-b border-border-subtle">
        <p className="text-sm font-bold text-text-primary truncate">
          Negocios en la zona ({cluster.businesses.length}+)
        </p>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onExpand}
            title="Acercar al grupo"
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[13px] font-semibold text-cerulean hover:bg-tm-bg active:scale-95 transition-all"
          >
            Ver mapa
          </button>
          <button
            onClick={onClose}
            aria-label="Cerrar sugerencias del grupo"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto">
        {cluster.businesses.slice(0, visibleCount).map((b) => (
          <button
            key={b.id}
            onClick={() => onSelectBusiness(b)}
            className="w-full flex items-center gap-3 px-4 py-2 min-h-[52px] text-left hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-border-subtle last:border-0"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-tm-bg text-lg flex-shrink-0 shrink-0">
              {CATEGORY_EMOJI[b.category] ?? '\u{1F4CD}'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary truncate">
                {b.name}
                {b.transferActiveNow && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-brand flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-brand animate-pulse" />
                    Activo
                  </span>
                )}
              </span>
              <span className="block text-xs text-slate-500 truncate">
                {b.neighborhood ?? b.municipality} ·{' '}
                {CATEGORIES.find((c) => c.id === b.category)?.label ?? b.category}
              </span>
            </span>
          </button>
        ))}
        {visibleCount < cluster.businesses.length && (
          <button
            onClick={onShowMore}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold text-cerulean hover:bg-tm-bg active:bg-slate-100 transition-colors"
          >
            Ver más negocios ({cluster.businesses.length - visibleCount})
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
