/** Validación de los planes de pago. Funciones puras, sin I/O. */

export const PLAN_SCOPES = ['ACCOUNT', 'BUSINESS'] as const;
export type PlanScope = (typeof PLAN_SCOPES)[number];

export const PAYMENT_METHODS = ['efectivo', 'transferencia'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PLAN_REVIEW_ACTIONS = ['confirm', 'reject'] as const;
export type PlanReviewAction = (typeof PLAN_REVIEW_ACTIONS)[number];

export const REFERENCE_MAX = 80;
export const PRICE_MAX_CUP = 100_000;

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v);
}

export function isPlanReviewAction(v: unknown): v is PlanReviewAction {
  return typeof v === 'string' && (PLAN_REVIEW_ACTIONS as readonly string[]).includes(v);
}

export function isPlanCode(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z][a-z0-9_]{1,40}$/.test(v);
}

/**
 * Pagar por transferencia sin referencia deja al administrador sin nada que
 * cotejar contra el banco, así que ahí sí es obligatoria. En efectivo no.
 */
export function referenceFor(
  method: PaymentMethod,
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  const texto = typeof raw === 'string' ? raw.trim() : '';
  if (method === 'transferencia') {
    if (texto.length < 3) {
      return { ok: false, error: 'En transferencia hace falta la referencia del pago' };
    }
    if (texto.length > REFERENCE_MAX) {
      return { ok: false, error: `La referencia no puede superar ${REFERENCE_MAX} caracteres` };
    }
    return { ok: true, value: texto };
  }
  if (texto.length > REFERENCE_MAX) {
    return { ok: false, error: `La referencia no puede superar ${REFERENCE_MAX} caracteres` };
  }
  return { ok: true, value: texto || null };
}

export function toPriceCup(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > PRICE_MAX_CUP) return null;
  return Math.round(n * 100) / 100;
}

export function toPeriodDays(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 365) return null;
  return n;
}
