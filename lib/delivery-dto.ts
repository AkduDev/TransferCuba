/**
 * TransferCuba — DTOs públicos del módulo de mensajería/delivery.
 *
 * La privacidad se aplica AQUÍ (campo a campo según el rol del que mira), no
 * en el DAO: la misma fila produce vistas distintas para solicitante,
 * mensajero y admin.
 */

import type { DeliveryRequestRow, PackageType, DeliveryStatus } from './db-delivery';

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
  packageType: PackageType;
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

export interface DeliveryDTOOptions {
  /** Incluir direcciones de pickup/dropoff. */
  includeLocations?: boolean;
  /** Incluir identidad del solicitante. */
  includeRequester?: boolean;
  /** Incluir identidad del mensajero. */
  includeMessenger?: boolean;
}

function fmt(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function toNum(v: string | number | null): number | null {
  return v === null || v === undefined ? null : Number(v);
}

export function toDeliveryDTO(row: DeliveryRequestRow, opts: DeliveryDTOOptions = {}): DeliveryDTO {
  const includeLocations = opts.includeLocations ?? false;
  const includeRequester = opts.includeRequester ?? false;
  const includeMessenger = opts.includeMessenger ?? false;
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    packageType: row.package_type,
    packageNote: row.package_note,
    fragile: row.fragile,
    payableOnDelivery: row.payable_on_delivery,
    pickup: includeLocations
      ? { lat: row.pickup_lat, lng: row.pickup_lng, address: row.pickup_address, note: row.pickup_note }
      : null,
    dropoff: includeLocations
      ? { lat: row.dropoff_lat, lng: row.dropoff_lng, address: row.dropoff_address, note: row.dropoff_note }
      : null,
    distanceKm: toNum(row.distance_km),
    durationMin: row.duration_min,
    totalFareCup: toNum(row.total_fare_cup),
    requestedAt: row.requested_at.toISOString(),
    respondedAt: fmt(row.responded_at),
    pickedUpAt: fmt(row.picked_up_at),
    deliveredAt: fmt(row.delivered_at),
    cancelledAt: fmt(row.cancelled_at),
    updatedAt: row.updated_at.toISOString(),
    trustedBy: row.trusted_by,
    trustedAt: fmt(row.trusted_at),
    requester:
      includeRequester && row.requester_name
        ? { id: row.requester_id, name: row.requester_name }
        : null,
    messenger:
      includeMessenger && row.messenger_id && row.messenger_name
        ? { id: row.messenger_id, name: row.messenger_name }
        : null
  };
}
/* ---------------- valoraciones (Fase 6) ---------------- */

import type { DeliveryReviewRow, MessengerStats, ReviewStatus } from './db-delivery';

export interface DeliveryReviewDTO {
  id: string;
  deliveryId: string;
  deliveryCode: string;
  requester: { id: string; name: string };
  messenger: { id: string; name: string };
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
}

export interface MessengerStatsDTO {
  rating: number | null;
  reviewCount: number;
  completedOrders: number;
}

/**
 * El comentario se guarda como texto y se entrega como texto: nada de HTML.
 * Quien lo pinta lo hace con `{comment}` en JSX, que escapa por defecto.
 */
export function toDeliveryReviewDTO(r: DeliveryReviewRow): DeliveryReviewDTO {
  return {
    id: r.id,
    deliveryId: r.delivery_id,
    deliveryCode: r.delivery_code ?? '',
    requester: { id: r.requester_id, name: r.requester_name ?? '' },
    messenger: { id: r.messenger_id, name: r.messenger_name ?? '' },
    rating: Number(r.rating),
    comment: r.comment,
    status: r.status,
    createdAt: r.created_at.toISOString()
  };
}

export function toMessengerStatsDTO(s: MessengerStats): MessengerStatsDTO {
  return { rating: s.rating, reviewCount: s.reviewCount, completedOrders: s.completedOrders };
}
