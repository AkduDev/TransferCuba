'use client';

import React from 'react';
import Image from 'next/image';
import { Business } from '@/lib/cuba-data';
import { getCategoryStyle } from '@/lib/category-style';

interface BusinessCoverProps {
  business: Business;
  /** clases de tamaño del contenedor (h-36, h-44, w-[72px]...) */
  className?: string;
  /** sizes hint para next/image */
  sizes?: string;
  /** esquinas redondeadas del contenedor */
  rounded?: string;
  /** miniatura compacta (icono solo) vs banner (icono + categoría + nombre) */
  variant?: 'thumb' | 'banner';
}

export default function BusinessCover({
  business,
  className = '',
  sizes,
  rounded = 'rounded-xl',
  variant = 'banner'
}: BusinessCoverProps) {
  const catStyle = getCategoryStyle(business.category);
  const CategoryIcon = catStyle.icon;
  const hasPhoto = business.photos && business.photos.length > 0;

  if (hasPhoto) {
    return (
      <div
        className={`relative overflow-hidden flex-shrink-0 ${rounded} ${className}`}
      >
        <Image
          src={business.photos[0]}
          alt={business.name}
          fill
          className="object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          sizes={sizes || '400px'}
        />
        {variant === 'banner' && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
        )}
      </div>
    );
  }

  const [bg, fg] = catStyle.iconBg.split(' ');

  if (variant === 'thumb') {
    return (
      <div
        className={`relative overflow-hidden flex items-center justify-center flex-shrink-0 border border-border-subtle ${bg} ${fg} ${rounded} ${className}`}
      >
        <CategoryIcon className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden flex flex-col items-center justify-center gap-1.5 flex-shrink-0 ${bg} ${fg} ${rounded} ${className}`}
    >
      <CategoryIcon className="w-10 h-10 opacity-80" />
      <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
        {catStyle.label}
      </span>
    </div>
  );
}
