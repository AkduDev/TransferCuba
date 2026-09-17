/**
 * TransferCuba — tipos del cliente para el módulo de delivery/mensajería.
 *
 * Reflejan los DTO del servidor (`lib/delivery-dto.ts` / `lib/db-delivery.ts`)
 * pero sin arrastrar tipos de BD al cliente. Se mantienen a mano (sin
 * dependencias de serialización).
 */

export type DeliveryStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface DeliveryLocationDTO {
  lat: number;
  lng: number;
  address: string;
  note: string | null;
}

export interface DeliveryDTO {
  id: string;
  code: string;
  status: DeliveryStatus;
  packageType: string;
  packageNote: string | null;
  fragile: boolean;
  payableOnDelivery: boolean;
  pickup: DeliveryLocationDTO | null;
  dropoff: DeliveryLocationDTO | null;
  distanceKm: number | null;
  durationMin: number | null;
  totalFareCup: number | null;
  requestedAt: string;
  respondedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  trustedBy: string | null;
  trustedAt: string | null;
  requester: { id: string; name: string } | null;
  messenger: { id: string; name: string } | null;
}

export interface AvailableDeliveryDTO {
  id: string;
  code: string;
  status: 'PENDING';
  packageType: string;
  packageNote: string | null;
  fragile: boolean;
  payableOnDelivery: boolean;
  distanceKm: number | null;
  durationMin: number | null;
  totalFareCup: number | null;
  requestedAt: string;
  pickup: { lat: number; lng: number; address: string; note: string | null };
}

export interface EstimateBreakdown {
  baseCup: number;
  paidKm: number;
  details: { label: string; km: number; rate: number }[];
}

export interface EstimateResult {
  distanceMeters: number;
  distanceKm: number;
  durationMin: number;
  totalFareCup: number;
  breakdown: EstimateBreakdown;
}

export interface DeliveryPoint {
  lat: number;
  lng: number;
  address: string;
}

export interface CreateDeliveryInput {
  packageType: string;
  packageNote?: string;
  fragile?: boolean;
  payableOnDelivery?: boolean;
  pickup: Pick<DeliveryPoint, 'lat' | 'lng' | 'address'> & { note?: string };
  dropoff: Pick<DeliveryPoint, 'lat' | 'lng' | 'address'> & { note?: string };
}

/** Valores válidos de `package_type` (deben coincidir con el server). */
export const PACKAGE_TYPES = ['documento', 'comida', 'medicina', 'paquete', 'generic'] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  documento: 'Documento',
  comida: 'Comida',
  medicina: 'Medicinas',
  paquete: 'Paquete',
  generic: 'Otro'
};

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: 'Buscando mensajero',
  ACCEPTED: 'Mensajero en camino al origen',
  PICKED_UP: 'Paquete recogido',
  IN_TRANSIT: 'En camino al destino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado'
};