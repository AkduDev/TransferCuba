/**
 * TransferCuba — identidad de usuarios (teléfono + contraseña) y sesión por cookie.
 *
 * Módulo SERVER-ONLY (usa node:crypto). Es independiente de lib/admin-auth.ts:
 * la sesión admin (cookie `tc_admin_session`, contra ADMIN_USERNAME/ADMIN_PASSWORD)
 * sigue siendo otra superficie y no se toca aquí. Este módulo gobierna la
 * identidad real de la plataforma (roles USER / BUSINESS / MESSENGER / ADMIN).
 *
 * Decisiones:
 *  - Contraseña hasheada con scrypt + sal aleatoria (sin dependencias externas).
 *  - Sesión REVOCABLE: la cookie HttpOnly lleva solo el id de sesión; la
 *    validez vive en la tabla `sessions` (logout real, bloqueo de cuenta).
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { findSessionUser, type PublicUser, type Role } from '@/lib/db-auth';

const COOKIE_NAME = 'tc_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const SCRYPT_KEYLEN = 64;

/* ---------------- contraseña ---------------- */

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = parts[1];
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(pin, salt, SCRYPT_KEYLEN);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 72;
}

export function isValidName(name: string): boolean {
  const n = name.trim();
  return n.length >= 3 && n.length <= 80;
}

/* ---------------- cookies de sesión ---------------- */

export interface CookieSpec {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

export function authCookie(sessionId: string): CookieSpec {
  return {
    name: COOKIE_NAME,
    value: sessionId,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
      secure: process.env.NODE_ENV === 'production'
    }
  };
}

export function clearAuthCookie(): CookieSpec {
  return {
    name: COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      secure: process.env.NODE_ENV === 'production'
    }
  };
}

function readCookie<T>(req: T): string | undefined {
  const cookies = (req as unknown as {
    cookies?: { get?: (n: string) => { value?: string } | undefined };
  }).cookies;
  return cookies?.get?.(COOKIE_NAME)?.value;
}

/** Id de sesión presente en la Request (sin validar contra la BD). */
export function getSessionId(req: NextRequest): string | undefined {
  return readCookie(req);
}

/* ---------------- autorización ---------------- */

/** Usuario de la sesión, o null. Nunca lanza: sin BD / inválida ⇒ null. */
export async function getSessionUser(req: NextRequest): Promise<PublicUser | null> {
  const id = getSessionId(req);
  if (!id) return null;
  try {
    return await findSessionUser(id);
  } catch {
    return null;
  }
}

export type AuthResult =
  | { ok: true; user: PublicUser }
  | { ok: false; status: 401 | 403 };

/** Exige sesión válida. No toca NextResponse; el endpoint traduce el status. */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const user = await getSessionUser(req);
  return user ? { ok: true, user } : { ok: false, status: 401 };
}

/** Exige sesión válida y, si se indican, uno de los roles permitidos. */
export async function requireRole(req: NextRequest, ...roles: Role[]): Promise<AuthResult> {
  const res = await requireAuth(req);
  if (!res.ok) return res;
  if (roles.length > 0 && !roles.includes(res.user.role)) {
    return { ok: false, status: 403 };
  }
  return res;
}

export { COOKIE_NAME };
