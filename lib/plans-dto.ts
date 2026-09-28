/**
 * Frontera de los planes.
 *
 * El teléfono de quien paga solo viaja con `includePayer`, que es cosa del
 * panel de administración: en la respuesta que ve el propio dueño no pinta
 * nada, y en el catálogo público sería una fuga.
 */

import type {
  PlanRow,
  PlanPaymentRow,
  PlanPaymentDetailRow,
  SubscriptionDetailRow
} from './db-plans';
import type { PlanScope } from './plans-validate';

export interface PlanDTO {
  code: string;
  name: string;
  scope: PlanScope;
  priceCup: number;
  periodDays: number;
  features: string[];
  active: boolean;
}

export interface PlanPaymentDTO {
  id: string;
  amountCup: number;
  periodDays: number;
  method: string;
  kind: string;
  status: string;
  reference: string | null;
  createdAt: string;
  plan?: { code: string; name: string; scope: PlanScope };
  business?: { id: string; name: string | null };
  payer?: { id: string; name: string; phone: string };
}

export interface SubscriptionDTO {
  id: string;
  planCode: string;
  planName: string;
  scope: PlanScope;
  features: string[];
  businessId: string | null;
  businessName: string | null;
  status: string;
  expiresAt: string | null;
  daysLeft: number | null;
  lastPaymentStatus: string | null;
}

export function toPlanDTO(row: PlanRow): PlanDTO {
  return {
    code: row.code,
    name: row.name,
    scope: row.scope,
    priceCup: Number(row.price_cup),
    periodDays: row.period_days,
    features: row.features,
    active: row.active
  };
}

export function toPlanPaymentDTO(
  row: PlanPaymentRow | PlanPaymentDetailRow,
  opciones: { includePayer?: boolean; includePlan?: boolean } = {}
): PlanPaymentDTO {
  const detalle = 'plan_name' in row ? (row as PlanPaymentDetailRow) : null;
  const dto: PlanPaymentDTO = {
    id: row.id,
    amountCup: Number(row.amount_cup),
    periodDays: row.period_days,
    method: row.method,
    kind: row.kind,
    status: row.status,
    reference: row.reference,
    createdAt: new Date(row.created_at).toISOString()
  };
  if (opciones.includePlan && detalle) {
    dto.plan = { code: detalle.plan_code, name: detalle.plan_name, scope: detalle.plan_scope };
    if (detalle.business_id) {
      dto.business = { id: detalle.business_id, name: detalle.business_name };
    }
  }
  if (opciones.includePayer && detalle) {
    dto.payer = { id: detalle.user_id, name: detalle.user_name, phone: detalle.user_phone };
  }
  return dto;
}

/** Días que quedan, redondeados hacia arriba: "queda 1 día" hasta que vence. */
function diasQueQuedan(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

export function toSubscriptionDTO(row: SubscriptionDetailRow): SubscriptionDTO {
  return {
    id: row.id,
    planCode: row.plan_code,
    planName: row.plan_name,
    scope: row.plan_scope,
    features: row.plan_features,
    businessId: row.business_id,
    businessName: row.business_name,
    status: row.status,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    daysLeft: diasQueQuedan(row.expires_at),
    lastPaymentStatus: row.payment_status
  };
}
