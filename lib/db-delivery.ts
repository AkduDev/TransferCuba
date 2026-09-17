/**
 * TransferCuba — acceso a datos del módulo de mensajería/delivery.
 *
 * Módulo SERVER-ONLY. Mismo patrón que lib/db-auth.ts: pool propio con
 * tiempos acotados y circuit breaker. Sin fallback in-memory: la carrera es
 * un contrato real entre solicitante y mensajero, no cabe en un array.
 */

import { Pool } from 'pg';
import { DbUnavailableError } from './db-auth';
import type { Role } from './db-auth';
import { DEFAULT_PRICING } from './pricing';
import type { PricingConfig } from './pricing';

export { DbUnavailableError };

export type DeliveryStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PackageType = 'documento' | 'comida' | 'medicina' | 'paquete' | 'generic';
export type MessengerProfileStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'REJECTED';

export interface DeliveryRequestRow {
  id: string;
  code: string;
  status: DeliveryStatus;
  requester_id: string;
  messenger_id: string | null;
  package_type: PackageType;
  package_note: string | null;
  fragile: boolean;
  payable_on_delivery: boolean;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  pickup_note: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  dropoff_note: string | null;
  distance_km: string | number | null;
  duration_min: number | null;
  route_geojson: object | null;
  base_fare_cup: string | number | null;
  total_fare_cup: string | number | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  trusted_by: string | null;
  trusted_at: Date | null;
  requested_at: Date;
  responded_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  updated_at: Date;
  requester_name?: string;
  messenger_name?: string;
}

export interface PlatformConfig {
  messengerFeeCup: number;
  messengerPayCard: string;
  messengerWhatsapp: string;
}

export interface DeliveryCreationInput {
  requesterId: string;
  packageType: PackageType;
  packageNote?: string;
  fragile?: boolean;
  payableOnDelivery?: boolean;
  pickup: { lat: number; lng: number; address: string; note?: string };
  dropoff: { lat: number; lng: number; address: string; note?: string };
  distanceKm: number;
  durationMin: number;
  routeGeojson: object | null;
  totalFareCup: number;
}

/* ---------------- pool y breaker (compartidos con identidad) ---------------- */

import {
  getDbPool,
  shouldAttemptDb,
  markDbUnavailable,
  markDbAvailable
} from './db-auth';

export function isDeliveryDbConfigured(): boolean {
  return getDbPool() !== null;
}

function isDomainError(err: unknown): boolean {
  return err instanceof InvalidTransitionError || err instanceof InvalidPricingError;
}

async function run<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = getDbPool();
  if (!pool || !shouldAttemptDb()) throw new DbUnavailableError();
  try {
    const out = await fn(pool);
    markDbAvailable();
    return out;
  } catch (err) {
    if (isDomainError(err)) throw err;
    if ((err as { code?: string }).code) {
      markDbAvailable();
      throw err;
    }
    markDbUnavailable(err);
    throw new DbUnavailableError();
  }
}

async function withClient<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const pool = getDbPool();
  if (!pool || !shouldAttemptDb()) throw new DbUnavailableError();
  let client: import('pg').PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    markDbUnavailable(err);
    throw new DbUnavailableError();
  }
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (isDomainError(err)) throw err;
    if ((err as { code?: string }).code) {
      markDbAvailable();
      throw err;
    }
    markDbUnavailable(err);
    throw new DbUnavailableError();
  } finally {
    client.release();
  }
}

/* ---------------- conversión de filas ---------------- */

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return Number(v);
}

/* ---------------- pricing / platform config ---------------- */

function mapPricingRow(r: Record<string, unknown>): PricingConfig {
  return {
    baseCup: Number(r.base_cup),
    freeKm: Number(r.free_km),
    smallKmThreshold: Number(r.small_km_threshold),
    smallKmRateCup: Number(r.small_km_rate_cup),
    largeKmThreshold: Number(r.large_km_threshold),
    largeKmRateCup: Number(r.large_km_rate_cup),
    extraKmRateCup: Number(r.extra_km_rate_cup)
  };
}

export async function getPricingConfig(): Promise<PricingConfig> {
  return run(async (pool) => {
    const res = await pool.query('SELECT * FROM pricing_config WHERE id = 1');
    if (res.rows[0]) return mapPricingRow(res.rows[0]);
    await pool.query(`INSERT INTO pricing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    const inserted = await pool.query('SELECT * FROM pricing_config WHERE id = 1');
    return mapPricingRow(inserted.rows[0]);
  });
}

export class InvalidPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPricingError';
  }
}

export async function updatePricingConfig(
  cfg: Partial<PricingConfig>,
  updatedBy: string | null
): Promise<PricingConfig> {
  const current = await getPricingConfig();
  const next: PricingConfig = { ...current, ...cfg };
  if (!Number.isFinite(next.baseCup) || next.baseCup < 0) throw new InvalidPricingError('Tarifa base inválida');
  if (!Number.isFinite(next.freeKm) || next.freeKm < 0) throw new InvalidPricingError('Kilómetros gratis inválidos');
  if (next.smallKmThreshold <= next.freeKm) throw new InvalidPricingError('El primer tramo debe superar los km gratis');
  if (next.largeKmThreshold <= next.smallKmThreshold) throw new InvalidPricingError('El segundo tramo debe superar al primero');
  if ([next.smallKmRateCup, next.largeKmRateCup, next.extraKmRateCup].some((v) => !Number.isFinite(v) || v < 0)) {
    throw new InvalidPricingError('Tarifas por km inválidas');
  }
  return run(async (pool) => {
    const res = await pool.query(
      `UPDATE pricing_config SET
         base_cup = $1, free_km = $2, small_km_threshold = $3, small_km_rate_cup = $4,
         large_km_threshold = $5, large_km_rate_cup = $6, extra_km_rate_cup = $7,
         updated_by = $8, updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [
        next.baseCup,
        next.freeKm,
        next.smallKmThreshold,
        next.smallKmRateCup,
        next.largeKmThreshold,
        next.largeKmRateCup,
        next.extraKmRateCup,
        updatedBy
      ]
    );
    return mapPricingRow(res.rows[0]);
  });
}

function mapPlatformRow(r: Record<string, unknown>): PlatformConfig {
  return {
    messengerFeeCup: Number(r.messenger_fee_cup),
    messengerPayCard: String(r.messenger_pay_card ?? ''),
    messengerWhatsapp: String(r.messenger_whatsapp ?? '')
  };
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  return run(async (pool) => {
    const res = await pool.query('SELECT * FROM platform_config WHERE id = 1');
    if (res.rows[0]) return mapPlatformRow(res.rows[0]);
    await pool.query(`INSERT INTO platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    const inserted = await pool.query('SELECT * FROM platform_config WHERE id = 1');
    return mapPlatformRow(inserted.rows[0]);
  });
}

export async function updatePlatformConfig(
  cfg: Partial<PlatformConfig>,
  updatedBy: string | null
): Promise<PlatformConfig> {
  const current = await getPlatformConfig();
  const next = { ...current, ...cfg };
  if (!Number.isFinite(next.messengerFeeCup) || next.messengerFeeCup < 0) {
    throw new InvalidPricingError('Tarifa de alta inválida');
  }
  return run(async (pool) => {
    const res = await pool.query(
      `UPDATE platform_config SET
         messenger_fee_cup = $1, messenger_pay_card = $2, messenger_whatsapp = $3,
         updated_by = $4, updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [next.messengerFeeCup, next.messengerPayCard, next.messengerWhatsapp, updatedBy]
    );
    return mapPlatformRow(res.rows[0]);
  });
}

/* ---------------- código de carrera ---------------- */

import { randomBytes } from 'node:crypto';

export function generateDeliveryCode(): string {
  const n = randomBytes(4).readUInt32BE(0);
  const s = n.toString(36).toUpperCase().padStart(5, '0');
  return `TC-${s.length > 5 ? s.slice(s.length - 5) : s}`;
}

/* ---------------- delivery_requests ---------------- */

const REQUEST_COLUMNS = `
  SELECT d.*, u.name AS requester_name, m.name AS messenger_name
  FROM delivery_requests d
  LEFT JOIN users u ON u.id = d.requester_id
  LEFT JOIN users m ON m.id = d.messenger_id
`;

export async function createDeliveryRequest(input: DeliveryCreationInput): Promise<DeliveryRequestRow> {
  const code = generateDeliveryCode();
  try {
    const res = await run((pool) =>
      pool.query<DeliveryRequestRow>(
        `INSERT INTO delivery_requests (
           code, requester_id, package_type, package_note, fragile, payable_on_delivery,
           pickup_lat, pickup_lng, pickup_address, pickup_note,
           dropoff_lat, dropoff_lng, dropoff_address, dropoff_note,
           distance_km, duration_min, route_geojson, total_fare_cup,
           base_fare_cup
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [
          code,
          input.requesterId,
          input.packageType,
          input.packageNote ?? null,
          input.fragile ?? false,
          input.payableOnDelivery ?? false,
          input.pickup.lat,
          input.pickup.lng,
          input.pickup.address,
          input.pickup.note ?? null,
          input.dropoff.lat,
          input.dropoff.lng,
          input.dropoff.address,
          input.dropoff.note ?? null,
          input.distanceKm,
          input.durationMin,
          input.routeGeojson ?? null,
          input.totalFareCup,
          input.totalFareCup
        ]
      )
    );
    return res.rows[0];
  } catch (err) {
    if ((err as { code?: string }).code === '23505' && code.length > 0) {
      return createDeliveryRequest(input);
    }
    throw err;
  }
}

export async function getDeliveryRequest(id: string): Promise<DeliveryRequestRow | null> {
  const res = await run((pool) =>
    pool.query<DeliveryRequestRow>(`${REQUEST_COLUMNS} WHERE d.id = $1`, [id])
  );
  return res.rows[0] ?? null;
}

export async function getDeliveryRequestByCode(code: string): Promise<DeliveryRequestRow | null> {
  const res = await run((pool) =>
    pool.query<DeliveryRequestRow>(`${REQUEST_COLUMNS} WHERE UPPER(d.code) = $1`, [code.toUpperCase()])
  );
  return res.rows[0] ?? null;
}

const PENDING_EXPIRY_MINUTES = 15;

/** Expira carreras PENDING viejas (lazy, sin cron) y registra el evento. */
export async function expirePendingDeliveries(): Promise<number> {
  return withClient(async (client) => {
    const res = await client.query<{ id: string }>(
      `UPDATE delivery_requests SET status = 'EXPIRED', updated_at = NOW()
       WHERE status = 'PENDING' AND requested_at < NOW() - ($1::int || ' minutes')::interval
       RETURNING id`,
      [PENDING_EXPIRY_MINUTES]
    );
    for (const row of res.rows) {
      await client.query(
        `INSERT INTO delivery_status_events (delivery_id, from_status, to_status, actor_role, note)
         VALUES ($1, 'PENDING', 'EXPIRED', 'SYSTEM', 'Sin aceptar en 15 minutos')`,
        [row.id]
      );
    }
    return res.rowCount ?? 0;
  });
}

export async function listAvailableDeliveries(limit = 20): Promise<DeliveryRequestRow[]> {
  await expirePendingDeliveries();
  const res = await run((pool) =>
    pool.query<DeliveryRequestRow>(
      `SELECT d.*,
              u.name AS requester_name,
              NULL::text AS messenger_name
       FROM delivery_requests d
       JOIN users u ON u.id = d.requester_id
       WHERE d.status = 'PENDING'
       ORDER BY d.requested_at ASC
       LIMIT $1`,
      [limit]
    )
  );
  return res.rows;
}

export async function listDeliveriesForRequester(userId: string, limit = 30): Promise<DeliveryRequestRow[]> {
  const res = await run((pool) =>
    pool.query<DeliveryRequestRow>(
      `${REQUEST_COLUMNS} WHERE d.requester_id = $1 ORDER BY d.requested_at DESC LIMIT $2`,
      [userId, limit]
    )
  );
  return res.rows;
}

export async function listDeliveriesForMessenger(messengerId: string, limit = 30): Promise<DeliveryRequestRow[]> {
  const res = await run((pool) =>
    pool.query<DeliveryRequestRow>(
      `${REQUEST_COLUMNS} WHERE d.messenger_id = $1 ORDER BY d.requested_at DESC LIMIT $2`,
      [messengerId, limit]
    )
  );
  return res.rows;
}

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export interface TransitionInput {
  id: string;
  fromStatuses: DeliveryStatus[];
  toStatus: DeliveryStatus;
  actorId: string | null;
  actorRole: Role | 'SYSTEM';
  note?: string | null;
  cancelReason?: string | null;
}

export const ALLOWED_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED', 'EXPIRED'],
  ACCEPTED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: []
};

/**
 * Transición de estado con bloqueo por fila (concurrency-safe): SOLO actualiza
 * si el estado actual está en `fromStatuses` y si el destino está en la
 * whitelist. Doble aceptación de una carrera queda imposible: el segundo
 * UPDATE devuelve 0 filas → InvalidTransitionError.
 */
export async function transitionDelivery(input: TransitionInput): Promise<DeliveryRequestRow> {
  return withClient(async (client) => {
    const locked = await client.query<{ status: string }>(
      'SELECT status FROM delivery_requests WHERE id = $1 FOR UPDATE',
      [input.id]
    );
    const row = locked.rows[0];
    if (!row) throw new InvalidTransitionError('Carrera no encontrada');
    if (!input.fromStatuses.includes(row.status as DeliveryStatus)) {
      throw new InvalidTransitionError(`Transición no permitida desde ${row.status}`);
    }
    if (!(ALLOWED_TRANSITIONS[row.status as DeliveryStatus] ?? []).includes(input.toStatus)) {
      throw new InvalidTransitionError(`No se puede pasar de ${row.status} a ${input.toStatus}`);
    }

    await client.query(
      `UPDATE delivery_requests SET
         status = $1, updated_at = NOW(),
         messenger_id = CASE WHEN $1 = 'ACCEPTED' AND $3::uuid IS NOT NULL THEN COALESCE(messenger_id, $3) ELSE messenger_id END,
         responded_at = CASE WHEN $1 = 'ACCEPTED' THEN COALESCE(responded_at, NOW()) ELSE responded_at END,
         picked_up_at = CASE WHEN $1 = 'PICKED_UP' THEN COALESCE(picked_up_at, NOW()) ELSE picked_up_at END,
         delivered_at = CASE WHEN $1 = 'DELIVERED' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
         cancelled_at = CASE WHEN $1 = 'CANCELLED' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
         cancel_reason = CASE WHEN $1 = 'CANCELLED' THEN $4 ELSE cancel_reason END,
         cancelled_by = CASE WHEN $1 = 'CANCELLED' THEN $3 ELSE cancelled_by END
       WHERE id = $2`,
      [input.toStatus, input.id, input.actorId, input.cancelReason ?? null]
    );
    await client.query(
      `INSERT INTO delivery_status_events (delivery_id, from_status, to_status, actor_id, actor_role, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.id,
        row.status,
        input.toStatus,
        input.actorId,
        input.actorRole,
        input.note ?? null
      ]
    );

    const updated = await client.query<DeliveryRequestRow>(
      `${REQUEST_COLUMNS} WHERE d.id = $1`,
      [input.id]
    );
    return updated.rows[0];
  });
}

/**
 * El solicitante "confía" el pago al mensajero una vez entregado (solo DELIVERED
 * y una sola vez por carrera). No valida rol aquí: lo hace la ruta.
 */
export async function trustDelivery(deliveryId: string, userId: string): Promise<DeliveryRequestRow | null> {
  return run((pool) =>
    pool.query<DeliveryRequestRow>(
      `UPDATE delivery_requests SET
         trusted_by = $2, trusted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'DELIVERED' AND trusted_by IS NULL
       RETURNING *`,
      [deliveryId, userId]
    ).then((r) => r.rows[0] ?? null)
  );
}

/* ---------------- messengers_profiles ---------------- */

export interface MessengerProfileRow {
  id: string;
  user_id: string;
  vehicle: string;
  service_areas: string[];
  status: MessengerProfileStatus;
  rating: string | number;
  completed_orders: number;
  active_since: Date | null;
  created_at: Date;
}

export async function getMessengerProfile(userId: string): Promise<MessengerProfileRow | null> {
  const res = await run((pool) =>
    pool.query<MessengerProfileRow>('SELECT * FROM messengers_profiles WHERE user_id = $1', [userId])
  );
  return res.rows[0] ?? null;
}

export async function upsertMessengerProfile(input: {
  userId: string;
  vehicle: string;
  serviceAreas: string[];
}): Promise<MessengerProfileRow> {
  const res = await run((pool) =>
    pool.query<MessengerProfileRow>(
      `INSERT INTO messengers_profiles (user_id, vehicle, service_areas)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         vehicle = EXCLUDED.vehicle,
         service_areas = EXCLUDED.service_areas
       RETURNING *`,
      [input.userId, input.vehicle, input.serviceAreas]
    )
  );
  return res.rows[0];
}

export async function setMessengerProfileStatus(
  userId: string,
  status: MessengerProfileStatus
): Promise<MessengerProfileRow | null> {
  const res = await run((pool) =>
    pool.query<MessengerProfileRow>(
      `UPDATE messengers_profiles
       SET status = $1,
           active_since = CASE WHEN $1 = 'ACTIVE' THEN COALESCE(active_since, NOW()) ELSE active_since END
       WHERE user_id = $2
       RETURNING *`,
      [status, userId]
    )
  );
  return res.rows[0] ?? null;
}

/* ---------------- messengers_payments ---------------- */

export interface MessengerPaymentRow {
  id: string;
  messenger_id: string;
  amount_cup: string | number;
  status: PaymentStatus;
  reference: string | null;
  evidence_note: string | null;
  confirmed_by: string | null;
  confirmed_at: Date | null;
  created_at: Date;
}

export async function createMessengerPayment(input: {
  messengerId: string;
  amountCup: number;
  reference?: string;
}): Promise<MessengerPaymentRow> {
  const res = await run((pool) =>
    pool.query<MessengerPaymentRow>(
      `INSERT INTO messengers_payments (messenger_id, amount_cup, reference)
       VALUES ($1, $2, $3) RETURNING *`,
      [input.messengerId, input.amountCup, input.reference ?? null]
    )
  );
  return res.rows[0];
}

export async function listMessengerPayments(messengerId: string): Promise<MessengerPaymentRow[]> {
  const res = await run((pool) =>
    pool.query<MessengerPaymentRow>(
      `SELECT * FROM messengers_payments WHERE messenger_id = $1 ORDER BY created_at DESC`,
      [messengerId]
    )
  );
  return res.rows;
}

export async function setPaymentStatus(input: {
  paymentId: string;
  toStatus: PaymentStatus;
  confirmedBy?: string | null;
  evidenceNote?: string | null;
}): Promise<MessengerPaymentRow | null> {
  const res = await run((pool) =>
    pool.query<MessengerPaymentRow>(
      `UPDATE messengers_payments SET
         status = $1,
         evidence_note = COALESCE($2, evidence_note),
         confirmed_by = CASE WHEN $1 IN ('CONFIRMED','REJECTED') THEN $3 ELSE confirmed_by END,
         confirmed_at = CASE WHEN $1 IN ('CONFIRMED','REJECTED') THEN NOW() ELSE confirmed_at END
       WHERE id = $4 RETURNING *`,
      [input.toStatus, input.evidenceNote ?? null, input.confirmedBy ?? null, input.paymentId]
    )
  );
  return res.rows[0] ?? null;
}

export function mapDeliveryRowBase(r: DeliveryRequestRow) {
  const fareTotal = toNum(r.total_fare_cup);
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    packageType: r.package_type,
    packageNote: r.package_note,
    fragile: r.fragile,
    payableOnDelivery: r.payable_on_delivery,
    distanceKm: toNum(r.distance_km),
    durationMin: r.duration_min,
    totalFareCup: fareTotal,
    requestedAt: r.requested_at.toISOString(),
    updatedAt: r.updated_at.toISOString()
  };
}

export { DEFAULT_PRICING };