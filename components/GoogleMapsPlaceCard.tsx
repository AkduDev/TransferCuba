'use client';

import React from 'react';
import {
  Star,
  Navigation,
  BadgeCheck,
  Bike
} from 'lucide-react';
import { Business, formatDistance, CATEGORY_EMOJI } from '@/lib/cuba-data';
import { getCategoryStyle } from '@/lib/category-style';
import BusinessCover from '@/components/BusinessCover';

export { getCategoryStyle };
export type { CategoryStyle } from '@/lib/category-style';

/* Badges de pago — labels completos para claridad comercial */
function PaymentBadge({ kind }: { kind: 'tm' | 'ez' | 'qr' | 'cash' }) {
  const styles = {
    tm: { cls: 'bg-tm-bg text-tm-text border-tm-border', label: 'Transfermóvil', title: 'Transfermóvil' },
    ez: { cls: 'bg-ez-bg text-ez-text border-ez-border', label: 'EnZona', title: 'EnZona' },
    qr: { cls: 'bg-qr-bg text-qr-text border-border-subtle', label: 'QR', title: 'Código QR' },
    cash: { cls: 'bg-ash-bg text-ash-text border-emerald-200', label: 'Efectivo', title: 'Efectivo' }
  }[kind];

  return (
    <span
      title={styles.title}
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${styles.cls}`}
    >
      {styles.label}
    </span>
  );
}

interface GoogleMapsPlaceCardProps {
  business: Business;
  onSelect: (biz: Business) => void;
  onCalculateRoute?: (biz: Business) => void;
  isSelected?: boolean;
}

export default function GoogleMapsPlaceCard({
  business,
  onSelect,
  onCalculateRoute,
  isSelected = false
}: GoogleMapsPlaceCardProps) {
  const catStyle = getCategoryStyle(business.category);
  const emoji = CATEGORY_EMOJI[business.category] ?? '🏪';

  return (
    <article
      onClick={() => onSelect(business)}
      className={`group bg-card border border-border-subtle rounded-xl p-3.5 cursor-pointer transition-all duration-150 text-left shadow-level-1 hover:shadow-level-2 hover:border-border-strong ${
        isSelected ? 'ring-2 ring-cerulean/40 border-cerulean' : ''
      }`}
    >
      {/* Top: nombre + badge de estado a la derecha + miniatura */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className="text-[15px] font-bold text-text-primary truncate leading-snug group-hover:text-cerulean-dark transition-colors">
                {business.name}
              </h4>
              {business.transferVerified && (
                <BadgeCheck className="w-4 h-4 text-emerald-brand flex-shrink-0" aria-label="Verificado" />
              )}
            </div>
            {/* Badge de estado transfer — protagonista arriba a la derecha */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                business.transferActiveNow
                  ? 'bg-emerald-brand/10 text-emerald-brand'
                  : 'bg-saffron/10 text-saffron'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  business.transferActiveNow ? 'bg-emerald-brand animate-pulse' : 'bg-saffron'
                }`}
              />
              {business.transferActiveNow ? 'Activa' : 'Sin transfer'}
            </span>
          </div>

          {/* Ubicación + distancia */}
          <p className="text-xs text-text-muted mt-1 truncate">
            {business.distanceMeters !== undefined && (
              <>
                <span className="font-semibold text-navy">
                  {formatDistance(business.distanceMeters)}
                </span>
                <span className="mx-1">·</span>
              </>
            )}
            {business.municipality}
            {business.neighborhood ? `, ${business.neighborhood}` : ''}
          </p>

          {/* Categoría con emoji + rating */}
          <div className="flex items-center gap-1.5 mt-1.5 text-xs">
            <span>{emoji}</span>
            <span className="text-text-muted">{catStyle.label}</span>
            <span className="mx-1 text-slate-300">·</span>
            <Star className="w-3.5 h-3.5 text-saffron fill-saffron" />
            <span className="font-bold text-text-primary">
              {business.rating ? business.rating.toFixed(1) : '4.8'}
            </span>
            <span className="text-text-muted">({business.reviewsCount || 16})</span>
          </div>
        </div>

        {/* Miniatura: foto real (lazy) o icono de categoría */}
        <BusinessCover
          business={business}
          variant="thumb"
          className="w-[72px] h-[72px] group-hover:scale-105 transition-transform duration-300"
          sizes="72px"
        />
      </div>

      {/* Badges de pago con labels completos */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border-subtle flex-wrap">
        {business.transferDetails?.transfermovil && <PaymentBadge kind="tm" />}
        {business.transferDetails?.enzona && <PaymentBadge kind="ez" />}
        {business.transferDetails?.qrPayment && <PaymentBadge kind="qr" />}
        {business.transferDetails?.cash && <PaymentBadge kind="cash" />}
      </div>

      {/* CTAs explícitos */}
      <div className="flex items-center gap-2 mt-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCalculateRoute?.(business);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-slate-50 border border-border-subtle text-xs font-bold text-slate-600 hover:bg-slate-100 hover:border-border-strong active:scale-[0.98] transition-all"
        >
          <Navigation className="w-3.5 h-3.5" />
          Cómo llegar
        </button>
        {business.hasDelivery && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(business);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-emerald-brand/10 border border-emerald-brand/30 text-xs font-bold text-emerald-brand hover:bg-emerald-brand/20 active:scale-[0.98] transition-all"
          >
            <Bike className="w-3.5 h-3.5" />
            Delivery
          </button>
        )}
      </div>
    </article>
  );
}
