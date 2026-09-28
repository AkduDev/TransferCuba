/**
 * DAO de los planes de pago.
 *
 * Mismo motor que el mensajero: pago en efectivo o transferencia, confirmación
 * manual del administrador, vigencia por días. Dos diferencias deliberadas:
 *
 *  - Los precios viven en la tabla `plans`, así que un plan nuevo es una fila.
 *  - El importe y el periodo se CONGELAN en la fila del pago al solicitarlo. Si
 *    el administrador sube el precio mañana, quien ya pidió conserva el suyo.
 *
 * La caducidad se barre de forma perezosa al leer, no con un cron: sin proceso
 * de fondo no hay nada que se quede sin correr y pase desapercibido.
 */

import { crearEjecutor } from './db-runner';
import type { PlanScope, PaymentMethod, PlanReviewAction } from './plans-validate';

export type PlanErrorReason =
  | 'not_found'
  | 'inactive'
  | 'scope'
  | 'ownership'
  | 'duplicate'
  | 'state';

export class InvalidPlanError extends Error {
  readonly reason: PlanErrorReason;
  constructor(reason: PlanErrorReason, message: string) {
    super(message);
    this.name = 'InvalidPlanError';
    this.reason = reason;
  }
}

const { run, withClient } = crearEjecutor((err) => err instanceof InvalidPlanError);

export interface PlanRow {
  code: string;
  name: string;
  scope: PlanScope;
  price_cup: string | number;
  period_days: number;
  features: string[];
  active: boolean;
  sort_order: number;
  updated_at: Date;
}

export interface PlanSubscriptionRow {
  id: string;
  plan_code: string;
  user_id: string;
  business_id: string | null;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'EXPIRED';
  starts_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

export interface PlanPaymentRow {
  id: string;
  subscription_id: string;
  amount_cup: string | number;
  period_days: number;
  method: PaymentMethod;
  reference: string | null;
  kind: 'alta' | 'renovacion';
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  confirmed_by: string | null;
  confirmed_at: Date | null;
  created_at: Date;
}

export interface PlanPaymentDetailRow extends PlanPaymentRow {
  plan_code: string;
  plan_name: string;
  plan_scope: PlanScope;
  subscription_status: PlanSubscriptionRow['status'];
  user_id: string;
  user_name: string;
  user_phone: string;
  business_id: string | null;
  business_name: string | null;
}

export interface SubscriptionDetailRow extends PlanSubscriptionRow {
  plan_name: string;
  plan_scope: PlanScope;
  plan_features: string[];
  business_name: string | null;
  payment_status: PlanPaymentRow['status'] | null;
  payment_amount_cup: string | number | null;
}

/** Marca como vencidas las que ya pasaron de fecha. Barrido perezoso. */
async function barrerVencidas(client: {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}): Promise<void> {
  await client.query(
    `UPDATE plan_subscriptions SET status = 'EXPIRED'
     WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at < NOW()`
  );
}

export async function listPlans(soloActivos = true): Promise<PlanRow[]> {
  return run(async (pool) => {
    const res = await pool.query<PlanRow>(
      `SELECT * FROM plans ${soloActivos ? 'WHERE active' : ''} ORDER BY sort_order, code`
    );
    return res.rows;
  });
}

export async function updatePlan(
  code: string,
  cambios: { priceCup?: number; periodDays?: number; active?: boolean; name?: string }
): Promise<PlanRow> {
  return run(async (pool) => {
    const res = await pool.query<PlanRow>(
      `UPDATE plans SET
         price_cup   = COALESCE($2, price_cup),
         period_days = COALESCE($3, period_days),
         active      = COALESCE($4, active),
         name        = COALESCE($5, name),
         updated_at  = NOW()
       WHERE code = $1
       RETURNING *`,
      [
        code,
        cambios.priceCup ?? null,
        cambios.periodDays ?? null,
        cambios.active ?? null,
        cambios.name ?? null
      ]
    );
    if (!res.rows[0]) throw new InvalidPlanError('not_found', 'Ese plan no existe');
    return res.rows[0];
  });
}

/**
 * Pide un plan. No lo activa: deja un pago pendiente que el administrador
 * confirma, igual que el alta de mensajero.
 *
 * Si ya hay una suscripción ACTIVA, esto es una renovación sobre la misma fila.
 */
export async function requestPlan(input: {
  userId: string;
  planCode: string;
  businessId: string | null;
  method: PaymentMethod;
  reference: string | null;
}): Promise<{ subscription: PlanSubscriptionRow; payment: PlanPaymentRow }> {
  return withClient(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.userId]);
    await barrerVencidas(client);

    const planRes = await client.query<PlanRow>('SELECT * FROM plans WHERE code = $1', [
      input.planCode
    ]);
    const plan = planRes.rows[0];
    if (!plan) throw new InvalidPlanError('not_found', 'Ese plan no existe');
    if (!plan.active) throw new InvalidPlanError('inactive', 'Ese plan no está disponible ahora');

    if (plan.scope === 'BUSINESS') {
      if (!input.businessId) {
        throw new InvalidPlanError('scope', 'Ese plan necesita que elijas un negocio');
      }
      const duenoRes = await client.query(
        'SELECT 1 FROM businesses WHERE id = $1 AND owner_user_id = $2',
        [input.businessId, input.userId]
      );
      if (!duenoRes.rowCount) {
        throw new InvalidPlanError(
          'ownership',
          'Solo puedes promocionar un negocio que ya sea tuyo'
        );
      }
    } else if (input.businessId) {
      throw new InvalidPlanError('scope', 'La cuenta premium cubre todos tus negocios');
    }

    const vivaRes = await client.query<PlanSubscriptionRow>(
      `SELECT * FROM plan_subscriptions
       WHERE plan_code = $1 AND user_id = $2
         AND business_id IS NOT DISTINCT FROM $3
         AND status IN ('PENDING', 'ACTIVE')
       FOR UPDATE`,
      [input.planCode, input.userId, input.businessId]
    );
    let subscription = vivaRes.rows[0] ?? null;

    if (subscription) {
      const pagoVivo = await client.query(
        `SELECT 1 FROM plan_payments
         WHERE subscription_id = $1 AND status = 'PENDING'`,
        [subscription.id]
      );
      if (pagoVivo.rowCount) {
        throw new InvalidPlanError(
          'duplicate',
          'Ya hay un pago pendiente de confirmar para ese plan'
        );
      }
    } else {
      const creada = await client.query<PlanSubscriptionRow>(
        `INSERT INTO plan_subscriptions (plan_code, user_id, business_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [input.planCode, input.userId, input.businessId]
      );
      subscription = creada.rows[0];
    }

    const kind = subscription.status === 'ACTIVE' ? 'renovacion' : 'alta';
    const pago = await client.query<PlanPaymentRow>(
      `INSERT INTO plan_payments
         (subscription_id, amount_cup, period_days, method, reference, kind)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        subscription.id,
        plan.price_cup,
        plan.period_days,
        input.method,
        input.reference,
        kind
      ]
    );

    return { subscription, payment: pago.rows[0] };
  });
}

export async function listPendingPlanPayments(limit = 100): Promise<PlanPaymentDetailRow[]> {
  const tope = Math.min(Math.max(Math.trunc(limit) || 0, 1), 200);
  return run(async (pool) => {
    const res = await pool.query<PlanPaymentDetailRow>(
      `SELECT p.*,
              s.plan_code, s.status AS subscription_status, s.user_id, s.business_id,
              pl.name AS plan_name, pl.scope AS plan_scope,
              u.name AS user_name, u.phone AS user_phone,
              b.name AS business_name
       FROM plan_payments p
       JOIN plan_subscriptions s ON s.id = p.subscription_id
       JOIN plans pl ON pl.code = s.plan_code
       JOIN users u ON u.id = s.user_id
       LEFT JOIN businesses b ON b.id = s.business_id
       WHERE p.status = 'PENDING'
       ORDER BY p.created_at ASC
       LIMIT $1`,
      [tope]
    );
    return res.rows;
  });
}

/**
 * Confirma o rechaza un pago.
 *
 * Al confirmar, la vigencia se cuenta desde el vencimiento anterior si todavía
 * no ha pasado: renovar antes de tiempo suma, no reinicia.
 */
export async function reviewPlanPayment(input: {
  paymentId: string;
  action: PlanReviewAction;
  adminUserId: string | null;
}): Promise<PlanPaymentDetailRow> {
  return withClient(async (client) => {
    const pagoRes = await client.query<PlanPaymentRow>(
      'SELECT * FROM plan_payments WHERE id = $1 FOR UPDATE',
      [input.paymentId]
    );
    const pago = pagoRes.rows[0];
    if (!pago) throw new InvalidPlanError('not_found', 'Ese pago no existe');
    if (pago.status !== 'PENDING') {
      throw new InvalidPlanError('state', 'Ese pago ya fue resuelto');
    }

    await client.query(
      `UPDATE plan_payments
       SET status = $1, confirmed_by = $2, confirmed_at = NOW()
       WHERE id = $3`,
      [input.action === 'confirm' ? 'CONFIRMED' : 'REJECTED', input.adminUserId, pago.id]
    );

    if (input.action === 'confirm') {
      await client.query(
        `UPDATE plan_subscriptions
         SET status = 'ACTIVE',
             starts_at = COALESCE(starts_at, NOW()),
             expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW())
                          + ($2 || ' days')::interval
         WHERE id = $1`,
        [pago.subscription_id, String(pago.period_days)]
      );
    } else {
      // Rechazar un alta deja la suscripción rechazada; rechazar una renovación
      // no puede tumbar una vigencia todavía buena.
      await client.query(
        `UPDATE plan_subscriptions SET status = 'REJECTED'
         WHERE id = $1 AND status = 'PENDING'`,
        [pago.subscription_id]
      );
    }

    const res = await client.query<PlanPaymentDetailRow>(
      `SELECT p.*,
              s.plan_code, s.status AS subscription_status, s.user_id, s.business_id,
              pl.name AS plan_name, pl.scope AS plan_scope,
              u.name AS user_name, u.phone AS user_phone,
              b.name AS business_name
       FROM plan_payments p
       JOIN plan_subscriptions s ON s.id = p.subscription_id
       JOIN plans pl ON pl.code = s.plan_code
       JOIN users u ON u.id = s.user_id
       LEFT JOIN businesses b ON b.id = s.business_id
       WHERE p.id = $1`,
      [pago.id]
    );
    return res.rows[0];
  });
}

/** Lo que ve un dueño: sus suscripciones con el estado del último pago. */
export async function listSubscriptionsOfUser(userId: string): Promise<SubscriptionDetailRow[]> {
  return withClient(async (client) => {
    await barrerVencidas(client);
    const res = await client.query<SubscriptionDetailRow>(
      `SELECT s.*,
              pl.name AS plan_name, pl.scope AS plan_scope, pl.features AS plan_features,
              b.name AS business_name,
              p.status AS payment_status, p.amount_cup AS payment_amount_cup
       FROM plan_subscriptions s
       JOIN plans pl ON pl.code = s.plan_code
       LEFT JOIN businesses b ON b.id = s.business_id
       LEFT JOIN LATERAL (
         SELECT status, amount_cup FROM plan_payments
         WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1
       ) p ON true
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );
    return res.rows;
  });
}

/**
 * Qué funciones tiene desbloqueadas un negocio concreto. Une lo que da la
 * cuenta premium de su dueño con lo que da su promoción propia.
 *
 * Es la primitiva sobre la que se apoyará la Fase 3: nada de mirar `users.role`.
 */
export async function activeFeaturesForBusiness(businessId: string): Promise<string[]> {
  return run(async (pool) => {
    const res = await pool.query<{ feature: string }>(
      `SELECT DISTINCT unnest(pl.features) AS feature
       FROM plan_subscriptions s
       JOIN plans pl ON pl.code = s.plan_code
       LEFT JOIN businesses b ON b.owner_user_id = s.user_id
       WHERE s.status = 'ACTIVE'
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
         AND (
           (pl.scope = 'BUSINESS' AND s.business_id = $1)
           OR (pl.scope = 'ACCOUNT' AND b.id = $1)
         )`,
      [businessId]
    );
    return res.rows.map((r) => r.feature);
  });
}
