-- TransferCuba — Módulo de mensajería/delivery (Fase 1: modelo de datos).
-- Idempotente: seguro de re-ejecutar. Depende de `db/migrate_auth.sql` (users).
--
-- Tablas:
--   pricing_config          tramos de tarifa por km (singleton id=1)
--   platform_config         alta pagada de mensajeros (tarifa, tarjeta, WhatsApp)
--   messengers_profiles     perfil operativo del mensajero
--   delivery_requests       carreras (solicitud → entrega)
--   delivery_status_events  auditoría de transiciones de estado
--   messengers_payments     ledger del alta pagada / reactivación

-- ---------------- pricing_config ----------------

CREATE TABLE IF NOT EXISTS pricing_config (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  base_cup         NUMERIC(10, 2) NOT NULL DEFAULT 200,
  free_km          NUMERIC(5, 1)  NOT NULL DEFAULT 3,
  small_km_threshold NUMERIC(5, 1) NOT NULL DEFAULT 5,
  small_km_rate_cup NUMERIC(10, 2) NOT NULL DEFAULT 50,
  large_km_threshold NUMERIC(5, 1) NOT NULL DEFAULT 10,
  large_km_rate_cup NUMERIC(10, 2) NOT NULL DEFAULT 70,
  extra_km_rate_cup NUMERIC(10, 2) NOT NULL DEFAULT 100,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_rates_valid CHECK (
    base_cup >= 0
    AND free_km >= 0
    AND small_km_rate_cup >= 0
    AND large_km_rate_cup >= 0
    AND extra_km_rate_cup >= 0
    AND small_km_threshold > free_km
    AND large_km_threshold > small_km_threshold
  )
);

-- ---------------- platform_config ----------------

CREATE TABLE IF NOT EXISTS platform_config (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  messenger_fee_cup  NUMERIC(10, 2) NOT NULL DEFAULT 200,
  messenger_pay_card TEXT NOT NULL DEFAULT '',
  messenger_whatsapp TEXT NOT NULL DEFAULT '',
  updated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_fee_valid CHECK (messenger_fee_cup >= 0)
);

-- ---------------- messengers_profiles ----------------

CREATE TABLE IF NOT EXISTS messengers_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle          TEXT NOT NULL DEFAULT 'pie',
  service_areas    TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'PENDING',
  rating           NUMERIC(2, 1) NOT NULL DEFAULT 5.0,
  completed_orders INTEGER NOT NULL DEFAULT 0,
  active_since     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT messengers_vehicle_valid CHECK (vehicle IN ('pie', 'bicicleta', 'moto', 'auto', 'otro')),
  CONSTRAINT messengers_status_valid CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
  CONSTRAINT messengers_rating_valid CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT messengers_orders_valid CHECK (completed_orders >= 0)
);

-- ---------------- delivery_requests ----------------

CREATE TABLE IF NOT EXISTS delivery_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'PENDING',
  requester_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  messenger_id        UUID REFERENCES users(id) ON DELETE SET NULL,

  package_type        TEXT NOT NULL DEFAULT 'generic',
  package_note        TEXT,
  fragile             BOOLEAN NOT NULL DEFAULT false,
  payable_on_delivery BOOLEAN NOT NULL DEFAULT false,

  pickup_lat          DOUBLE PRECISION NOT NULL,
  pickup_lng          DOUBLE PRECISION NOT NULL,
  pickup_address      TEXT NOT NULL,
  pickup_note         TEXT,

  dropoff_lat         DOUBLE PRECISION NOT NULL,
  dropoff_lng         DOUBLE PRECISION NOT NULL,
  dropoff_address     TEXT NOT NULL,
  dropoff_note        TEXT,

  distance_km         NUMERIC(6, 1),
  duration_min        INTEGER,
  route_geojson       JSONB,
  base_fare_cup       NUMERIC(10, 2),
  total_fare_cup      NUMERIC(10, 2),

  cancel_reason       TEXT,
  cancelled_by        UUID REFERENCES users(id) ON DELETE SET NULL,

  trusted_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  trusted_at          TIMESTAMPTZ,

  requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at        TIMESTAMPTZ,
  picked_up_at        TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT delivery_status_valid CHECK (
    status IN ('PENDING','ACCEPTED','PICKED_UP','IN_TRANSIT','DELIVERED','CANCELLED','EXPIRED')
  ),
  CONSTRAINT delivery_package_valid CHECK (
    package_type IN ('documento','comida','medicina','paquete','generic')
  ),
  CONSTRAINT delivery_distance_valid CHECK (distance_km IS NULL OR distance_km >= 0),
  CONSTRAINT delivery_duration_valid CHECK (duration_min IS NULL OR duration_min >= 0),
  CONSTRAINT delivery_fares_valid CHECK (
    (base_fare_cup IS NULL OR base_fare_cup >= 0)
    AND (total_fare_cup IS NULL OR total_fare_cup >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_status        ON delivery_requests (status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_delivery_requests_requester     ON delivery_requests (requester_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_messenger     ON delivery_requests (messenger_id, requested_at DESC);

-- ---------------- delivery_status_events ----------------

CREATE TABLE IF NOT EXISTS delivery_status_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id   UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  from_status   TEXT,
  to_status     TEXT NOT NULL CHECK (
    to_status IN ('PENDING','ACCEPTED','PICKED_UP','IN_TRANSIT','DELIVERED','CANCELLED','EXPIRED')
  ),
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role    TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_delivery ON delivery_status_events (delivery_id, created_at);

-- ---------------- messengers_payments ----------------

CREATE TABLE IF NOT EXISTS messengers_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messenger_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cup     NUMERIC(10, 2) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'PENDING',
  reference      TEXT,
  evidence_note  TEXT,
  confirmed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_valid CHECK (amount_cup > 0),
  CONSTRAINT payments_status_valid CHECK (status IN ('PENDING','PAID','CONFIRMED','REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_messenger_payments_messenger ON messengers_payments (messenger_id, created_at DESC);

-- ---------------- seed singletons ----------------

INSERT INTO pricing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- columnas de "confianza" (Fase 3) para DBs creadas antes de esta adición
ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS trusted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS trusted_at TIMESTAMPTZ;
-- ============================================================================
-- Suscripción de mensajero (validez temporal y renovación)
--
-- Hasta aquí un alta confirmada valía para siempre. Ahora la condición de
-- mensajero caduca: se paga un importe por un periodo, y al vencer deja de
-- poder aceptar carreras hasta renovar. Importe y periodo los fija
-- administración; el rol y el historial NO se tocan al vencer.
-- ============================================================================

-- Periodo de validez en días, junto al importe que ya existía.
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS messenger_period_days INTEGER NOT NULL DEFAULT 30;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_period_valid'
  ) THEN
    ALTER TABLE platform_config
      ADD CONSTRAINT platform_period_valid CHECK (messenger_period_days BETWEEN 1 AND 365);
  END IF;
END $$;

-- Importe por defecto 300 CUP. Solo se toca el valor vivo si sigue siendo el
-- default anterior (200): si administración ya lo cambió, se respeta.
ALTER TABLE platform_config ALTER COLUMN messenger_fee_cup SET DEFAULT 300;
UPDATE platform_config SET messenger_fee_cup = 300 WHERE id = 1 AND messenger_fee_cup = 200;

-- Vencimiento de la suscripción. NULL = nunca activada.
ALTER TABLE messengers_profiles
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Los perfiles ya ACTIVE de antes de esta migración arrancan con un periodo
-- completo desde ahora: nadie pierde el acceso por desplegar.
UPDATE messengers_profiles
   SET expires_at = NOW() + (
         SELECT make_interval(days => messenger_period_days) FROM platform_config WHERE id = 1
       )
 WHERE status = 'ACTIVE' AND expires_at IS NULL;

-- Barrido y listados de administración por vencimiento.
CREATE INDEX IF NOT EXISTS idx_messengers_profiles_expires
  ON messengers_profiles (status, expires_at);

-- Método y naturaleza del pago. 'transferencia' por defecto porque es lo único
-- que existía antes de esta migración.
ALTER TABLE messengers_payments
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'transferencia';
ALTER TABLE messengers_payments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'alta';
ALTER TABLE messengers_payments
  ADD COLUMN IF NOT EXISTS covers_days INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messengers_payment_method_valid') THEN
    ALTER TABLE messengers_payments
      ADD CONSTRAINT messengers_payment_method_valid CHECK (method IN ('efectivo', 'transferencia'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messengers_payment_kind_valid') THEN
    ALTER TABLE messengers_payments
      ADD CONSTRAINT messengers_payment_kind_valid CHECK (kind IN ('alta', 'renovacion'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messengers_payments_pending
  ON messengers_payments (messenger_id, created_at DESC) WHERE status = 'PENDING';
