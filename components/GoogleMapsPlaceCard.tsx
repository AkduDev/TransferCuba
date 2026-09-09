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
  ShieldCheck
} from 'lucide-react';
import { Business, formatDistance } from '@/lib/cuba-data';

export interface CategoryStyle {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconText: string;
  borderColor: string;
}

export function getCategoryStyle(categoryKey: string): CategoryStyle {
  const cat = (categoryKey || '').toLowerCase();

  if (cat.includes('comida') || cat.includes('restaurante')) {
    return {
      icon: Utensils,
      label: 'Restaurante / Comida',
      badgeBg: 'bg-orange-50',
      badgeText: 'text-orange-700',
      iconBg: 'bg-orange-500',
      iconText: 'text-white',
      borderColor: 'border-orange-200'
    };
  }
  if (cat.includes('cafe') || cat.includes('cafeteria') || cat.includes('panaderia')) {
    return {
      icon: Coffee,
      label: 'Cafetería & Panadería',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      iconBg: 'bg-amber-600',
      iconText: 'text-white',
      borderColor: 'border-amber-200'
    };
  }
  if (cat.includes('tienda') || cat.includes('mercado')) {
    return {
      icon: ShoppingBag,
      label: 'Tienda & Mercado',
      badgeBg: 'bg-blue-50',
      badgeText: 'text-blue-700',
      iconBg: 'bg-blue-600',
      iconText: 'text-white',
      borderColor: 'border-blue-200'
    };
  }
  if (cat.includes('farmacia') || cat.includes('salud')) {
    return {
      icon: Pill,
      label: 'Farmacia & Salud',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
      iconBg: 'bg-rose-600',
      iconText: 'text-white',
      borderColor: 'border-rose-200'
    };
  }
  if (cat.includes('servicio') || cat.includes('celular') || cat.includes('reparacion')) {
    return {
      icon: Smartphone,
      label: 'Servicios & Celulares',
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-700',
      iconBg: 'bg-indigo-600',
      iconText: 'text-white',
      borderColor: 'border-indigo-200'
    };
  }
  if (cat.includes('ferreteria') || cat.includes('hogar')) {
    return {
      icon: Wrench,
      label: 'Ferretería & Hogar',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-900',
      iconBg: 'bg-amber-700',
      iconText: 'text-white',
      borderColor: 'border-amber-300'
    };
  }
  if (cat.includes('ropa') || cat.includes('calzado') || cat.includes('moda')) {
    return {
      icon: Shirt,
      label: 'Ropa & Calzado',
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      iconBg: 'bg-purple-600',
      iconText: 'text-white',
      borderColor: 'border-purple-200'
    };
  }

  return {
    icon: Store,
    label: 'Comercio',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    iconBg: 'bg-sky-600',
    iconText: 'text-white',
    borderColor: 'border-slate-200'
  };
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
      id={`place-card-${business.id}`}
      onClick={() => onSelect(business)}
      className={`group relative p-3.5 sm:p-4 border-b border-slate-200/80 cursor-pointer transition-colors duration-150 text-left ${
        isSelected
          ? 'bg-blue-50/70 border-blue-200'
          : 'bg-white hover:bg-slate-50 active:bg-slate-100'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Main Content Column */}
        <div className="flex-1 min-w-0">
          {/* Top Row: Category colored icon badge + Business Name */}
          <div className="flex items-center gap-2 mb-1 min-w-0">
            {/* Specific Google Maps category colored icon */}
            <div
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-xs ${catStyle.iconBg} ${catStyle.iconText}`}
              title={catStyle.label}
            >
              <CategoryIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate font-display">
              {business.name}
            </h4>

            {business.transferVerified && (
              <span title="Verificado DevParadise">
                <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              </span>
            )}
          </div>

          {/* Row 2: Rating, reviews count & category */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-normal mt-0.5 flex-wrap">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="font-bold text-slate-800">
                {business.rating ? business.rating.toFixed(1) : '4.8'}
              </span>
              <span className="text-slate-400 font-normal">
                ({business.reviewsCount || 16})
              </span>
            </div>
            <span className="text-slate-300">·</span>
            <span className={`font-medium ${catStyle.badgeText}`}>
              {business.category}
            </span>
          </div>

          {/* Row 3: Distance info in subtle muted color & location */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-normal mt-1 flex-wrap">
            {business.distanceMeters !== undefined ? (
              <>
                <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                  <Navigation className="w-3 h-3 text-slate-400" />
                  <span>A {formatDistance(business.distanceMeters)}</span>
                </span>
                <span className="text-slate-300">·</span>
              </>
            ) : null}
            <span className="text-slate-500 truncate">
              {business.neighborhood ? `${business.neighborhood}, ` : ''}{business.municipality}
            </span>
          </div>

          {/* Row 4: Status and Payment Badges */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                business.transferActiveNow
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/80'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  business.transferActiveNow ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>{business.transferActiveNow ? 'Transferencia activa' : 'Solo efectivo'}</span>
            </span>

            {/* Payment channel pills */}
            {business.transferDetails?.transfermovil && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200/70"
                title="Acepta Transfermóvil"
              >
                TM
              </span>
            )}
            {business.transferDetails?.enzona && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200/70"
                title="Acepta EnZona"
              >
                EZ
              </span>
            )}
            {business.transferDetails?.qrPayment && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200"
                title="Acepta código QR"
              >
                QR
              </span>
            )}
          </div>

          {/* Row 5: Action buttons */}
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCalculateRoute?.(business);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors active:scale-95"
              title="Trazar ruta hacia este lugar"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Ruta</span>
            </button>

            {business.whatsapp && (
              <a
                href={`https://wa.me/${
                  business.whatsapp.replace(/[^0-9]/g, '').startsWith('53')
                    ? business.whatsapp.replace(/[^0-9]/g, '')
                    : `53${business.whatsapp.replace(/[^0-9]/g, '')}`
                }?text=${encodeURIComponent(
                  `Hola ${business.name}, los vi en TransferCuba. Quisiera consultar disponibilidad.`
                )}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors active:scale-95"
                title="Escribir por WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}

            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors active:scale-95"
                title="Llamar al negocio"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Llamar</span>
              </a>
            )}
          </div>
        </div>

        {/* Right Column: Place Thumbnail */}
        <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden relative shadow-xs border border-slate-200/80 bg-slate-100 flex-shrink-0 self-start">
          {business.photos && business.photos.length > 0 ? (
            <Image
              src={business.photos[0]}
              alt={business.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="88px"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-100 to-slate-200 text-xl group-hover:scale-105 transition-transform">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs ${catStyle.iconBg} ${catStyle.iconText}`}
              >
                <CategoryIcon className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-bold text-slate-500 mt-1 truncate max-w-[70px] text-center px-1">
                {business.category}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
