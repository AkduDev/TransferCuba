/**
 * DAO de la propiedad de negocios.
 *
 * Publicar un negocio es gratis y anónimo. La PROPIEDAD es otra cosa: se
 * solicita y la confirma un administrador a mano, porque cualquiera puede
 * escribir que un local es suyo.
 *
 * Decisión que conviene no perder: **quién puede usar las funciones de dueño se
 * decide por la fila de `businesses.owner_user_id`, no por `users.role`.** El
 * rol es una sola columna y una misma persona puede ser mensajero y dueño a la
 * vez; si la autorización dependiera del rol, hacerse dueño le quitaría la
 * mensajería. El rol `BUSINESS` se pone solo como señal para la interfaz.
 */

import { crearEjecutor } from './db-runner';
import type { ClaimAction, ClaimStatus } from './ownership-validate';

/**
 * Por qué no se pudo hacer. El DAO no sabe de códigos HTTP; el endpoint
 * traduce:
 *  - `not_found`    el negocio o la solicitud no existen        → 404
 *  - `already_owned` el negocio ya tiene dueño confirmado       → 409
 *  - `duplicate`    esa persona ya tiene una solicitud viva     → 409
 *  - `state`        el negocio está rechazado, o la solicitud
 *                   ya fue resuelta                             → 409
 */
export type OwnershipErrorReason = 'not_found' | 'already_owned' | 'duplicate' | 'state';

export class InvalidOwnershipClaimError extends Error {
  readonly reason: OwnershipErrorReason;
  constructor(reason: OwnershipErrorReason, message: string) {
    super(message);
    this.name = 'InvalidOwnershipClaimError';
    this.reason = reason;
  }
}

function isDomainError(err: unknown): boolean {
  return err instanceof InvalidOwnershipClaimError;
}

// Envoltorios compartidos: ver lib/db-runner.ts.
const { run, withClient } = crearEjecutor(isDomainError);

export interface OwnershipClaimRow {
  id: string;
  business_id: string;
  user_id: string;
  status: ClaimStatus;
  evidence: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

/** Fila enriquecida para la cola del administrador. */
export interface OwnershipClaimDetailRow extends OwnershipClaimRow {
  business_name: string;
  business_status: string;
  business_province: string;
  business_municipality: string;
  claimant_name: string;
  claimant_phone: string;
}

export interface OwnedBusinessRow {
  id: string;
  name: string;
  status: string;
  province: string;
  municipality: string;
  claim_status: ClaimStatus | null;
}

/**
 * Registra una solicitud de propiedad. No cambia nada del negocio: solo deja
 * constancia de que alguien lo reclama.
 */
export async function claimBusiness(input: {
  businessId: string;
  userId: string;
  evidence: string | null;
}): Promise<OwnershipClaimRow> {
  return withClient(async (client) => {
    const negocio = await client.query<{ id: string; status: string; owner_user_id: string | null }>(
      'SELECT id, status, owner_user_id FROM businesses WHERE id = $1 FOR UPDATE',
      [input.businessId]
    );
    const row = negocio.rows[0];
    if (!row) {
      throw new InvalidOwnershipClaimError('not_found', 'Ese negocio no existe');
    }
    if (row.status === 'rejected') {
      throw new InvalidOwnershipClaimError('state', 'Ese negocio fue rechazado y no puede reclamarse');
    }
    if (row.owner_user_id) {
      throw new InvalidOwnershipClaimError(
        'already_owned',
        row.owner_user_id === input.userId
          ? 'Ese negocio ya es tuyo'
          : 'Ese negocio ya tiene dueño confirmado'
      );
    }

    const viva = await client.query(
      `SELECT 1 FROM business_ownership_claims
       WHERE business_id = $1 AND user_id = $2 AND status = 'PENDING'`,
      [input.businessId, input.userId]
    );
    if (viva.rowCount) {
      throw new InvalidOwnershipClaimError(
        'duplicate',
        'Ya tienes una solicitud pendiente sobre ese negocio'
      );
    }

    const creada = await client.query<OwnershipClaimRow>(
      `INSERT INTO business_ownership_claims (business_id, user_id, evidence)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.businessId, input.userId, input.evidence]
    );
    return creada.rows[0];
  });
}

/** Cola del administrador: solicitudes sin resolver, la más antigua primero. */
export async function listPendingClaims(limit = 100): Promise<OwnershipClaimDetailRow[]> {
  const tope = Math.min(Math.max(Math.trunc(limit) || 0, 1), 200);
  return run(async (pool) => {
    const res = await pool.query<OwnershipClaimDetailRow>(
      `SELECT c.*,
              b.name AS business_name,
              b.status AS business_status,
              b.province AS business_province,
              b.municipality AS business_municipality,
              u.name AS claimant_name,
              u.phone AS claimant_phone
       FROM business_ownership_claims c
       JOIN businesses b ON b.id = c.business_id
       JOIN users u ON u.id = c.user_id
       WHERE c.status = 'PENDING'
       ORDER BY c.created_at ASC
       LIMIT $1`,
      [tope]
    );
    return res.rows;
  });
}

/**
 * Confirma o rechaza. Al confirmar pasan tres cosas en la misma transacción:
 * el negocio queda ligado a esa persona, las demás solicitudes vivas sobre ese
 * negocio se rechazan, y el rol sube a BUSINESS **solo si era USER** — quien ya
 * es mensajero o administrador conserva el suyo, porque `users.role` es una
 * sola columna y la propiedad no vive ahí.
 */
export async function reviewClaim(input: {
  claimId: string;
  action: ClaimAction;
  adminUserId: string | null;
}): Promise<OwnershipClaimDetailRow> {
  return withClient(async (client) => {
    const actual = await client.query<OwnershipClaimRow>(
      'SELECT * FROM business_ownership_claims WHERE id = $1 FOR UPDATE',
      [input.claimId]
    );
    const claim = actual.rows[0];
    if (!claim) {
      throw new InvalidOwnershipClaimError('not_found', 'Esa solicitud no existe');
    }
    if (claim.status !== 'PENDING') {
      throw new InvalidOwnershipClaimError('state', 'Esa solicitud ya fue resuelta');
    }

    if (input.action === 'confirm') {
      const negocio = await client.query<{ owner_user_id: string | null }>(
        'SELECT owner_user_id FROM businesses WHERE id = $1 FOR UPDATE',
        [claim.business_id]
      );
      if (!negocio.rows[0]) {
        throw new InvalidOwnershipClaimError('not_found', 'Ese negocio ya no existe');
      }
      if (negocio.rows[0].owner_user_id) {
        throw new InvalidOwnershipClaimError(
          'already_owned',
          'Ese negocio ya tiene dueño: rechaza esta solicitud o libera el negocio antes'
        );
      }

      await client.query('UPDATE businesses SET owner_user_id = $1 WHERE id = $2', [
        claim.user_id,
        claim.business_id
      ]);
      await client.query(
        `UPDATE business_ownership_claims
         SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW()
         WHERE business_id = $2 AND status = 'PENDING' AND id <> $3`,
        [input.adminUserId, claim.business_id, claim.id]
      );
      await client.query(
        "UPDATE users SET role = 'BUSINESS' WHERE id = $1 AND role = 'USER' AND status = 'active'",
        [claim.user_id]
      );
    }

    await client.query(
      `UPDATE business_ownership_claims
       SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [input.action === 'confirm' ? 'CONFIRMED' : 'REJECTED', input.adminUserId, claim.id]
    );

    const res = await client.query<OwnershipClaimDetailRow>(
      `SELECT c.*,
              b.name AS business_name,
              b.status AS business_status,
              b.province AS business_province,
              b.municipality AS business_municipality,
              u.name AS claimant_name,
              u.phone AS claimant_phone
       FROM business_ownership_claims c
       JOIN businesses b ON b.id = c.business_id
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [claim.id]
    );
    return res.rows[0];
  });
}

/**
 * Lo que ve un dueño en su cuenta: los negocios que ya son suyos y los que ha
 * reclamado sin resolver. `claim_status` distingue unos de otros.
 */
export async function listBusinessesOfUser(userId: string): Promise<OwnedBusinessRow[]> {
  return run(async (pool) => {
    const res = await pool.query<OwnedBusinessRow>(
      `SELECT b.id, b.name, b.status, b.province, b.municipality,
              'CONFIRMED'::text AS claim_status
       FROM businesses b
       WHERE b.owner_user_id = $1
       UNION ALL
       SELECT b.id, b.name, b.status, b.province, b.municipality,
              c.status AS claim_status
       FROM business_ownership_claims c
       JOIN businesses b ON b.id = c.business_id
       WHERE c.user_id = $1 AND c.status = 'PENDING' AND b.owner_user_id IS NULL
       ORDER BY 2`,
      [userId]
    );
    return res.rows;
  });
}

/** ¿Es esta persona la dueña confirmada de este negocio? */
export async function isOwner(businessId: string, userId: string): Promise<boolean> {
  return run(async (pool) => {
    const res = await pool.query(
      'SELECT 1 FROM businesses WHERE id = $1 AND owner_user_id = $2',
      [businessId, userId]
    );
    return res.rowCount === 1;
  });
}
