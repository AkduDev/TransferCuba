import type { PackageType } from './db-delivery';

export const PACKAGE_TYPES = ['documento', 'comida', 'medicina', 'paquete', 'generic'] as const;

export function isValidPackageType(v: unknown): v is PackageType {
  return (PACKAGE_TYPES as readonly string[]).includes(String(v));
}

/** Coordenada finita dentro del rango indicado, o null. */
export function toCoord(v: unknown, min = -90, max = 90): number | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

export function isValidAddress(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length >= 3;
}

export function toOptionalNote(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= 300 ? t : null;
}