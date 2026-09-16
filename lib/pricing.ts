/**
 * TransferCuba — tarifas de mensajería por kilómetro.
 *
 * Tramo base: incluye `freeKm`. Luego se suma el km excedente según el rango:
 *   (freeKm, smallKmThreshold]  → smallKmRateCup  por km
 *   (smallKmThreshold, largeKmThreshold] → largeKmRateCup por km
 *   (largeKmThreshold, +∞)      → extraKmRateCup  por km
 * La configuración vive en BD (pricing_config, singleton id=1) y se edita
 * desde el panel admin; los defaults de abajo son el seed inicial.
 */

export interface PricingConfig {
  baseCup: number;
  freeKm: number;
  smallKmThreshold: number;
  smallKmRateCup: number;
  largeKmThreshold: number;
  largeKmRateCup: number;
  extraKmRateCup: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  baseCup: 200,
  freeKm: 3,
  smallKmThreshold: 5,
  smallKmRateCup: 50,
  largeKmThreshold: 10,
  largeKmRateCup: 70,
  extraKmRateCup: 100
};

/** Tarifa total redondeada a pesos enteros para una distancia dada. */
export function computeFare(distanceKm: number, cfg: PricingConfig = DEFAULT_PRICING): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  let total = cfg.baseCup;
  let remaining = distanceKm - cfg.freeKm;
  if (remaining <= 0) return Math.round(total);

  const smallSpan = Math.max(0, cfg.smallKmThreshold - cfg.freeKm);
  if (remaining > smallSpan) {
    total += smallSpan * cfg.smallKmRateCup;
    remaining -= smallSpan;
  } else {
    total += remaining * cfg.smallKmRateCup;
    return Math.round(total);
  }

  const largeSpan = Math.max(0, cfg.largeKmThreshold - cfg.smallKmThreshold);
  if (remaining > largeSpan) {
    total += largeSpan * cfg.largeKmRateCup;
    remaining -= largeSpan;
  } else {
    total += remaining * cfg.largeKmRateCup;
    return Math.round(total);
  }

  total += remaining * cfg.extraKmRateCup;
  return Math.round(total);
}

/** Fragmenta la distancia para mostrar desglose (base, km pagados por tramo). */
export function fareBreakdown(
  distanceKm: number,
  cfg: PricingConfig = DEFAULT_PRICING
): { baseCup: number; paidKm: number; details: { label: string; km: number; rate: number }[] } {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return { baseCup: cfg.baseCup, paidKm: 0, details: [] };
  }
  const details: { label: string; km: number; rate: number }[] = [];
  let remaining = Math.max(0, distanceKm - cfg.freeKm);

  const smallSpan = Math.max(0, cfg.smallKmThreshold - cfg.freeKm);
  const smallKm = Math.min(remaining, smallSpan);
  if (smallKm > 0.05) details.push({ label: `${cfg.smallKmThreshold} km`, km: smallKm, rate: cfg.smallKmRateCup });
  remaining -= smallKm;

  const largeSpan = Math.max(0, cfg.largeKmThreshold - cfg.smallKmThreshold);
  const largeKm = Math.min(remaining, largeSpan);
  if (largeKm > 0.05) details.push({ label: `${cfg.largeKmThreshold} km`, km: largeKm, rate: cfg.largeKmRateCup });
  remaining -= largeKm;

  if (remaining > 0.05) details.push({ label: 'más de', km: remaining, rate: cfg.extraKmRateCup });

  return { baseCup: cfg.baseCup, paidKm: Math.max(0, distanceKm - cfg.freeKm), details };
}