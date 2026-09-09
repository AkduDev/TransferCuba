'use client';

import React from 'react';
import Image from 'next/image';
import {
  Utensils,
  ShoppingBag,
  Pill,
  Coffee,
  Smartphone,
  Wrench,
  Shirt,
  Store,
  Star,
  Navigation,
  MessageCircle,
  Phone,
  ShieldCheck,
  BadgeCheck
} from 'lucide-react';
import { Business, formatDistance } from '@/lib/cuba-data';

export interface CategoryStyle {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  iconBg: string;
}

export function getCategoryStyle(categoryKey: string): CategoryStyle {
  const cat = (categoryKey || '').toLowerCase();

  if (cat.includes('comida') || cat.includes('restaurante')) {
    return { icon: Utensils, label: 'Gastronomía', iconBg: 'bg-saffron/10 text-saffron' };
  }
  if (cat.includes('cafe') || cat.includes('cafeteria') || cat.includes('panaderia')) {
    return { icon: Coffee, label: 'Cafetería', iconBg: 'bg-saffron/10 text-saffron' };
  }
  if (cat.includes('tienda') || cat.includes('mercado')) {
    return { icon: ShoppingBag, label: 'Tienda', iconBg: 'bg-cerulean/10 text-cerulean' };
  }
  if (cat.includes('farmacia') || cat.includes('salud')) {
    return { icon: Pill, label: 'Farmacia', iconBg: 'bg-crimson/10 text-crimson' };
  }
  if (cat.includes('servicio') || cat.includes('celular') || cat.includes('reparacion')) {
    return { icon: Smartphone, label: 'Servicios', iconBg: 'bg-cerulean/10 text-cerulean' };
  }
  if (cat.includes('ferreteria') || cat.includes('hogar')) {
    return { icon: Wrench, label: 'Ferretería', iconBg: 'bg-slate-500/10 text-slate-600' };
  }
  if (cat.includes('ropa') || cat.includes('calzado') || cat.includes('moda')) {
    return { icon: Shirt, label: 'Ropa', iconBg: 'bg-cerulean-dark/10 text-cerulean-dark' };
  }

  return { icon: Store, label: 'Comercio', iconBg: 'bg-slate-500/10 text-slate-600' };
}

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
  const CategoryIcon = catStyle.icon;

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

        {/* Miniatura */}
        <div className="w-[72px] h-[72px] rounded-lg overflow-hidden relative border border-border-subtle bg-slate-100 flex-shrink-0">
          {business.photos && business.photos.length > 0 ? (
            <Image
              src={business.photos[0]}
              alt={business.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="72px"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${catStyle.iconBg}`}>
              <CategoryIcon className="w-6 h-6" />
            </div>
          )}
        </div>
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
