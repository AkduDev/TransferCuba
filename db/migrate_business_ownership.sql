-- TransferCuba — propiedad de negocios (Fase 1 del módulo de dueños).
--
-- Publicar un negocio sigue siendo GRATIS y ANÓNIMO: esta migración no toca el
-- alta. Lo que añade es a quién pertenece un negocio ya publicado, porque sin
-- dueño no hay a quién ofrecerle funciones premium ni a quién cobrarle.
--
-- La propiedad no se declara, se SOLICITA: cualquiera podría decir que un
-- negocio es suyo, así que una solicitud espera a que un administrador la
-- confirme a mano, igual que el alta de mensajero.
--
-- Idempotente. Vive aquí y NO en `db/schema.sql` por la misma razón que las
-- tablas de mensajería: depende de `users`, que crea `migrate_auth.sql`, y esa
-- corre DESPUÉS de `schema.sql`. Meter una `REFERENCES users(id)` en el esquema
-- base lo abortaría a mitad en una base nueva — ya pasó una vez con el índice
-- de `business_promotions` (ver docs/operaciones.md).
--
-- `owner_user_id` ya existe en la base de producción; allí esto es un no-op.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_owner
  ON businesses (owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS business_ownership_claims (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
  -- Lo que aporta quien reclama para que el administrador pueda comprobarlo
  -- (un teléfono, una factura, el nombre del local…). Texto libre acotado.
  evidence    TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una persona no puede tener dos solicitudes vivas sobre el mismo negocio.
-- Parcial a propósito: sí puede volver a solicitarlo si la anterior se rechazó.
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_una_viva_por_persona
  ON business_ownership_claims (business_id, user_id) WHERE status = 'PENDING';

-- La cola del administrador: lo único que se lista con frecuencia.
CREATE INDEX IF NOT EXISTS idx_claims_pendientes
  ON business_ownership_claims (created_at DESC) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_claims_por_usuario
  ON business_ownership_claims (user_id, created_at DESC);
