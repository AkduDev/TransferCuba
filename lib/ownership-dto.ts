/**
 * Frontera entre la fila y lo que sale por la API.
 *
 * El teléfono y el nombre de quien reclama solo viajan con `includeClaimant`,
 * que es cosa del panel de administración: en la respuesta que ve el propio
 * solicitante no pintan nada, y en una lista pública serían una fuga.
 */

import type { OwnershipClaimDetailRow, OwnershipClaimRow, OwnedBusinessRow } from './db-ownership';
import type { ClaimStatus } from './ownership-validate';

export interface OwnershipClaimDTO {
  id: string;
  businessId: string;
  status: ClaimStatus;
  evidence: string | null;
  createdAt: string;
  reviewedAt: string | null;
  business?: {
    name: string;
    status: string;
    province: string;
    municipality: string;
  };
  claimant?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface OwnedBusinessDTO {
  id: string;
  name: string;
  status: string;
  province: string;
  municipality: string;
  /** CONFIRMED = ya es suyo. PENDING = lo ha reclamado y espera al admin. */
  ownership: ClaimStatus;
}

function esDetalle(row: OwnershipClaimRow | OwnershipClaimDetailRow): row is OwnershipClaimDetailRow {
  return 'business_name' in row;
}

export function toOwnershipClaimDTO(
  row: OwnershipClaimRow | OwnershipClaimDetailRow,
  opciones: { includeBusiness?: boolean; includeClaimant?: boolean } = {}
): OwnershipClaimDTO {
  const dto: OwnershipClaimDTO = {
    id: row.id,
    businessId: row.business_id,
    status: row.status,
    evidence: row.evidence,
    createdAt: new Date(row.created_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null
  };

  if (opciones.includeBusiness && esDetalle(row)) {
    dto.business = {
      name: row.business_name,
      status: row.business_status,
      province: row.business_province,
      municipality: row.business_municipality
    };
  }

  if (opciones.includeClaimant && esDetalle(row)) {
    dto.claimant = { id: row.user_id, name: row.claimant_name, phone: row.claimant_phone };
  }

  return dto;
}

export function toOwnedBusinessDTO(row: OwnedBusinessRow): OwnedBusinessDTO {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    province: row.province,
    municipality: row.municipality,
    ownership: row.claim_status ?? 'CONFIRMED'
  };
}
