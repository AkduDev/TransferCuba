/**
 * Validación de las solicitudes de propiedad de un negocio.
 *
 * Funciones puras, sin I/O: el DAO no valida y el endpoint no improvisa reglas.
 */

export const CLAIM_ACTIONS = ['confirm', 'reject'] as const;
export type ClaimAction = (typeof CLAIM_ACTIONS)[number];

export const CLAIM_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export function isClaimAction(value: unknown): value is ClaimAction {
  return typeof value === 'string' && (CLAIM_ACTIONS as readonly string[]).includes(value);
}

/**
 * El id de un negocio es TEXT, no UUID: conviven los del seed (`biz-1`) con los
 * UUID que genera el alta. Se acota igual, porque va a un `WHERE` y porque un
 * identificador sin tope es una vía de abuso.
 */
export function isBusinessId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export const EVIDENCE_MAX = 500;

/**
 * La evidencia es opcional —un teléfono, una factura, lo que sirva para que el
 * administrador compruebe— pero si viene, viene acotada. Devuelve `null` cuando
 * no hay nada que guardar, y `undefined` cuando lo que llegó no es admisible,
 * para que el endpoint pueda distinguir "vacío" de "inválido".
 */
export function toEvidence(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const limpio = value.trim();
  if (limpio.length === 0) return null;
  if (limpio.length > EVIDENCE_MAX) return undefined;
  return limpio;
}
