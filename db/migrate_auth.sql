-- TransferCuba — identidad y roles (Fase 0 del módulo de mensajería).
-- Migración idempotente. Aplicar con:
--   psql "$DATABASE_URL" -f db/migrate_auth.sql
--
-- Contexto: antes de esta migración solo existía la sesión admin (cookie
-- firmada contra ADMIN_USERNAME/ADMIN_PASSWORD, lib/admin-auth.ts). Aquí se
-- crea la identidad REAL de usuarios (teléfono + PIN) que sostendrá los roles
-- USER / BUSINESS / MESSENGER / ADMIN y el ownership de negocios.

-- Usuarios de la plataforma. El teléfono se guarda normalizado (solo dígitos).
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'BUSINESS', 'MESSENGER', 'ADMIN')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Sesiones revocables: la cookie HttpOnly lleva SOLO el id; la verdad (validez,
-- revocación, expiración) vive aquí. A diferencia del token firmado del admin,
-- esto permite logout real y bloqueo de cuenta sin esperar el TTL.
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_valid ON sessions (id) WHERE revoked_at IS NULL;

-- Ownership de negocios: quién administra cada negocio (rol BUSINESS).
-- Nullable: los negocios existentes/válidos no tienen dueño todavía.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses (owner_user_id);
