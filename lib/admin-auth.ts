/**
 * TransferCuba — autenticación del panel admin.
 *
 * Módulo SERVER-ONLY (usa node:crypto). Se importa únicamente desde
 * app/api/. El login real valida contra variables de entorno
 * (ADMIN_USERNAME/ADMIN_PASSWORD) con comparación timing-safe; la sesión es
 * un token firmado HMAC-SHA256 que viaja en cookie HttpOnly.
 *
 * Seguridad del diseño (docs/architecture.md — "Auth del panel admin"):
 *  - Sin credenciales en el bundle del cliente (antes estaban hardcodeadas).
 *  - El API rechaza con 401 las acciones admin sin token válido; el flag de
 *    localStorage del frontend ya no es la barrera real.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'tc_admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function adminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || 'admin';
}

function adminPassword(): string | null {
  const pass = process.env.ADMIN_PASSWORD;
  return pass && pass.length >= 4 ? pass : null;
}

function signingSecret(): string {
  // Secret dedicado si existe; si no, deriva del password para no exigir otra var.
  return process.env.ADMIN_TOKEN_SECRET || `tc-admin-${adminPassword() ?? 'unset'}`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function isAdminConfigured(): boolean {
  return adminPassword() !== null;
}

/** Valida credenciales contra el entorno. NO emite sesión. */
export function validateAdminCredentials(username: string, password: string): boolean {
  const pass = adminPassword();
  if (!pass) return false;
  return safeEqual(username.trim().toLowerCase(), adminUsername().toLowerCase())
    && safeEqual(password, pass);
}

export function signAdminSession(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url');
  const sig = createHmac('sha256', signingSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts as [string, string];
  const expected = createHmac('sha256', signingSecret())
    .update(payload)
    .digest('base64url');
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: number;
    };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

/** Lee y valida la sesión desde la cookie de la Request (NextRequest). */
export function sessionValidFromRequest<T>(req: T): boolean {
  const cookies = (req as unknown as { cookies?: { get?: (n: string) => { value?: string } | undefined } }).cookies;
  return verifyAdminSession(cookies?.get?.(COOKIE_NAME)?.value);
}

export function adminCookie(): { name: string; value: string; options: Record<string, unknown> } {
  return {
    name: COOKIE_NAME,
    value: signAdminSession(),
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
      secure: process.env.NODE_ENV === 'production'
    }
  };
}

export function clearAdminCookie(): {
  name: string;
  value: string;
  options: Record<string, unknown>;
} {
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

export { COOKIE_NAME };