import React from 'react';
import {
  Utensils,
  ShoppingBag,
  Pill,
  Coffee,
  Smartphone,
  Wrench,
  Shirt,
  Store
} from 'lucide-react';

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
