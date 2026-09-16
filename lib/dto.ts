// DTOs de la API v2 (V2_REFACTOR_PLAN.md, Fase 2.1).
// Separación: payload mínimo para el mapa vs. detalle completo del negocio.

// Payload mínimo que necesita el mapa (pins/clústeres/orden).
export interface MapBusiness {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  transferActiveNow: boolean;
  transferVerified: boolean;
  featured: boolean;
}

export interface BusinessHour {
  dayOfWeek: number; // 0 = domingo … 6 = sábado
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface BusinessImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  sortOrder: number;
  isCover: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  isActive: boolean;
}

export interface BusinessPromotion {
  type: 'featured' | 'sponsored' | 'promo';
  active: boolean;
}

export interface BusinessDetails {
  id: string;
  name: string;
  description: string;
  address: string;
  province: string;
  municipality: string;
  neighborhood: string | null;
  whatsapp: string;
  phone: string;
  hours: BusinessHour[];
  images: BusinessImage[];
  paymentMethods: PaymentMethod[];
  promotions: BusinessPromotion[];
  status: string;
  transferActiveNow: boolean;
  transferVerified: boolean;
  acceptsTransfer: boolean;
  averageRating: number;
  reviewsCount: number;
  confirmationsCount: number;
  reportsCount: number;
  createdAt: string;
  updatedAt: string;
}