'use client';

import React from 'react';
import {
  Star,
  Navigation,
  MessageCircle,
  Phone,
  ShieldCheck,
  BadgeCheck
} from 'lucide-react';
import { Business, formatDistance } from '@/lib/cuba-data';
import { getCategoryStyle } from '@/lib/category-style';
import BusinessCover from '@/components/BusinessCover';

export { getCategoryStyle };
export type { CategoryStyle } from '@/lib/category-style';

/* Badges de pago — tokens del design system Stitch */
function PaymentBadge({ kind }: { kind: 'tm' | 'ez' | 'qr' | 'cash' }) {
  const styles = {
    tm: { cls: 'bg-tm-bg text-tm-text border-tm-border', label: 'TM', title: 'Transfermóvil' },
    ez: { cls: 'bg-ez-bg text-ez-text border-ez-border', label: 'EZ', title: 'EnZona' },
    qr: { cls: 'bg-qr-bg text-qr-text border-border-subtle', label: 'QR', title: 'Código QR' },
    cash: { cls: 'bg-ash-bg text-ash-text border-emerald-200', label: 'CUP', title: 'Efectivo' }
  }[kind];

  return (
    <span
      title={styles.title}
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${styles.cls}`}
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

  return (
    <article
      onClick={() => onSelect(business)}
      className={`group bg-card border border-border-subtle rounded-xl p-3.5 cursor-pointer transition-all duration-150 text-left shadow-level-1 hover:shadow-level-2 hover:border-border-strong ${
        isSelected ? 'ring-2 ring-cerulean/40 border-cerulean' : ''
      }`}
    >
      {/* Top: nombre + verificación + miniatura */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className="text-[15px] font-bold text-text-primary truncate leading-snug group-hover:text-cerulean-dark transition-colors">
              {business.name}
            </h4>
            {business.transferVerified && (
              <BadgeCheck className="w-4 h-4 text-emerald-brand flex-shrink-0" aria-label="Verificado" />
            )}
          </div>

          {/* Ubicación + distancia en una línea */}
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

          {/* Rating discreto */}
          <div className="flex items-center gap-1 mt-1.5 text-xs">
            <Star className="w-3.5 h-3.5 text-saffron fill-saffron" />
            <span className="font-bold text-text-primary">
              {business.rating ? business.rating.toFixed(1) : '4.8'}
            </span>
            <span className="text-text-muted">({business.reviewsCount || 16})</span>
            <span className="mx-1 text-slate-300">·</span>
            <span className="text-text-muted">{catStyle.label}</span>
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

      {/* Divider + badges de pago (código de color nacional) */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border-subtle flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
          {business.transferActiveNow ? 'Transferencia activa' : 'Sin transfer'}
        </span>

        {business.transferDetails?.transfermovil && <PaymentBadge kind="tm" />}
        {business.transferDetails?.enzona && <PaymentBadge kind="ez" />}
        {business.transferDetails?.qrPayment && <PaymentBadge kind="qr" />}
        {business.transferDetails?.cash && <PaymentBadge kind="cash" />}

        {/* Acciones esenciales alineadas a la derecha */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCalculateRoute?.(business);
            }}
            aria-label="Cómo llegar"
            title="Cómo llegar"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-cerulean-dark hover:bg-slate-100 active:scale-95 transition-all"
          >
            <Navigation className="w-4 h-4" />
          </button>
          {business.whatsapp && (
            <a
              href={`https://wa.me/${
                business.whatsapp.replace(/[^0-9]/g, '').startsWith('53')
                  ? business.whatsapp.replace(/[^0-9]/g, '')
                  : `53${business.whatsapp.replace(/[^0-9]/g, '')}`
              }`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="WhatsApp"
              title="Escribir por WhatsApp"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-emerald-brand hover:bg-slate-100 active:scale-95 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          )}
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              onClick={(e) => e.stopPropagation()}
              aria-label="Llamar"
              title="Llamar al negocio"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-navy hover:bg-slate-100 active:scale-95 transition-all"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
