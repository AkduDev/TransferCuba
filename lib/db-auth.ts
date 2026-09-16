/**
 * TransferCuba — acceso a datos de identidad (usuarios y sesiones).
 *
 * Módulo SERVER-ONLY. Reutiliza DATABASE_URL con el mismo patrón que
 * lib/db.ts (Neon TLS + timeouts acotados + circuit breaker), pero a
 * diferencia del catálogo de negocios la identidad NO tiene fallback
 * in-memory: sin BD, register/login responden 503 y /me devuelve no
 * autenticado. Un usuario "en memoria" no tendría ownership ni trazabilidad.
 */

import { Pool } from 'pg';

export type Role = 'USER' | 'BUSINESS' | 'MESSENGER' | 'ADMIN';
export type UserStatus = 'active' | 'blocked';

export interface UserRow {
  id: string;
  phone: string;
  name: string;
  pin_hash: string;
  role: Role;
  status: UserStatus;
  created_at: Date;
  last_login_at: Date | null;
}

/** Proyección pública de un usuario (sin pin_hash). Es la que consumen los DTOs. */
export interface PublicUser {
  id: string;
  phone: string;
  name: string;
  role: Role;
  status: UserStatus;
}

export function toPublicUser(u: UserRow | PublicUser): PublicUser {
  return { id: u.id, phone: u.phone, name: u.name, role: u.role, status: u.status };
}

function poolOrNull(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const needsSsl = /neon\.tech|sslmode=require/.test(url) && !/sslmode=disable/.test(url);
  return new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 5_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined
  });
}

let poolRef: Pool | null | undefined;

function getPool(): Pool | null {
  if (poolRef === undefined) poolRef = poolOrNull();
  return poolRef;
}

export function isAuthDbConfigured(): boolean {
  return getPool() !== null;
}

/** Error controlado cuando la BD de identidad no está disponible (→ HTTP 503). */
export class DbUnavailableError extends Error {
  constructor() {
    super('Database unavailable');
    this.name = 'DbUnavailableError';
  }
}

/* ---------------- circuit breaker ---------------- */

const DB_RETRY_MS = 60_000;
let dbUnavailableUntil = 0;

function shouldAttemptDb(): boolean {
  return Date.now() >= dbUnavailableUntil;
}

function markDbUnavailable(err: unknown): void {
  if (dbUnavailableUntil <= Date.now()) {
    console.error(
      '[db-auth] PostgreSQL inalcanzable; reintentando en 60s:',
      (err as Error)?.message ?? err
    );
  }
  dbUnavailableUntil = Date.now() + DB_RETRY_MS;
}

function markDbAvailable(): void {
  dbUnavailableUntil = 0;
}

/**
 * Ejecuta una query reutilizando el pool y el breaker. Un error con `code`
 * (p.ej. UNIQUE 23505) significa que la BD SÍ respondió: se propaga tal cual
 * para que la API lo traduzca (409). Un error sin code se trata como caída.
 */
async function run<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = getPool();
  if (!pool || !shouldAttemptDb()) throw new DbUnavailableError();
  try {
    const out = await fn(pool);
    markDbAvailable();
    return out;
  } catch (err) {
    if ((err as { code?: string }).code) {
      markDbAvailable();
      throw err;
    }
    markDbUnavailable(err);
    throw new DbUnavailableError();
  }
}

/* ---------------- helpers de validación ---------------- */

/** Normaliza un teléfono a solo dígitos (7–15). Devuelve null si no es válido. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

/* ---------------- usuarios ---------------- */

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  const res = await run((p) => p.query<UserRow>('SELECT * FROM users WHERE phone = $1', [phone]));
  return res.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const res = await run((p) => p.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]));
  return res.rows[0] ?? null;
}

export async function createUser(input: {
  phone: string;
  name: string;
  pinHash: string;
  role?: Role;
}): Promise<UserRow> {
  const res = await run((p) =>
    p.query<UserRow>(
      `INSERT INTO users (phone, name, pin_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.phone, input.name, input.pinHash, input.role ?? 'USER']
    )
  );
  return res.rows[0];
}

export async function touchLastLogin(userId: string): Promise<void> {
  await run((p) => p.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]));
}

/* ---------------- sesiones ---------------- */

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const res = await run((p) =>
    p.query<{ id: string; expires_at: Date }>(
      'INSERT INTO sessions (user_id) VALUES ($1) RETURNING id, expires_at',
      [userId]
    )
  );
  return { id: res.rows[0].id, expiresAt: res.rows[0].expires_at };
}

/** Devuelve el usuario dueño de una sesión válida (no revocada y no expirada). */
export async function findSessionUser(sessionId: string): Promise<PublicUser | null> {
  const res = await run((p) =>
    p.query<PublicUser>(
      `SELECT u.id, u.phone, u.name, u.role, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()`,
      [sessionId]
    )
  );
  const user = res.rows[0];
  if (!user || user.status !== 'active') return null;
  return user;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await run((p) => p.query('UPDATE sessions SET revoked_at = NOW() WHERE id = $1', [sessionId]));
}
