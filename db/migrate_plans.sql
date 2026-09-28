-- TransferCuba — motor de planes de pago (Fase 2 del módulo de dueños).
--
-- Dos productos distintos, no dos precios del mismo:
--   · `business_promo`  — destaca UN negocio en el mapa.
--   · `owner_account`   — destaca TODOS los del dueño, más estadísticas y más
--                         fotos. Cuesta más, y no solo por cubrir más negocios:
--                         también da capacidades que el otro no tiene, para que
--                         quien solo tenga un negocio también gane algo al subir.
--
-- Los precios viven en `plans`, no en `platform_config`, porque un tercer plan
-- debe ser UNA FILA y no otra migración con dos columnas más. El administrador
-- los cambia desde el panel.
--
-- El motor de cobro es el mismo del mensajero, que ya funciona: pago en
-- efectivo o transferencia, confirmación manual del administrador y vigencia
-- por días. El importe y el periodo se CONGELAN en la fila del pago: si el
-- administrador sube el precio mañana, quien ya pagó conserva lo suyo.
--
-- Idempotente. Depende de `users` y `businesses`, así que vive aquí y no en
-- `db/schema.sql` (ver migrate_business_ownership.sql).

CREATE TABLE IF NOT EXISTS plans (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  -- ACCOUNT cubre todos los negocios del dueño; BUSINESS, uno concreto.
  scope       TEXT NOT NULL CHECK (scope IN ('ACCOUNT', 'BUSINESS')),
  price_cup   NUMERIC(10,2) NOT NULL CHECK (price_cup > 0),
  period_days INTEGER NOT NULL CHECK (period_days BETWEEN 1 AND 365),
  -- Qué desbloquea. Texto y no columnas booleanas para que añadir una función
  -- no obligue a migrar.
  features    TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Precios de partida; el administrador los ajusta desde el panel.
INSERT INTO plans (code, name, scope, price_cup, period_days, features, sort_order)
VALUES
  ('business_promo', 'Promocionar un negocio', 'BUSINESS', 200.00, 30, ARRAY['featured'], 1),
  ('owner_account', 'Cuenta premium', 'ACCOUNT', 500.00, 30,
   ARRAY['featured', 'stats', 'photos'], 2)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS plan_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code   TEXT NOT NULL REFERENCES plans(code),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Solo para los planes de ámbito BUSINESS. Lo exige el DAO: un CHECK no
  -- puede mirar la fila de `plans`.
  business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED')),
  starts_at   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una suscripción viva por cuenta y plan, y una por negocio y plan. Parciales:
-- lo vencido o rechazado no estorba para volver a contratar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_viva_por_cuenta
  ON plan_subscriptions (user_id, plan_code)
  WHERE business_id IS NULL AND status IN ('PENDING', 'ACTIVE');

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_viva_por_negocio
  ON plan_subscriptions (business_id, plan_code)
  WHERE business_id IS NOT NULL AND status IN ('PENDING', 'ACTIVE');

CREATE INDEX IF NOT EXISTS idx_sub_por_usuario
  ON plan_subscriptions (user_id, created_at DESC);

-- Las que caducan: la barre un repaso perezoso al leer.
CREATE INDEX IF NOT EXISTS idx_sub_activas_por_vencer
  ON plan_subscriptions (expires_at) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS plan_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES plan_subscriptions(id) ON DELETE CASCADE,
  -- Congelados al solicitar: cambiar el precio no reescribe lo ya pedido.
  amount_cup      NUMERIC(10,2) NOT NULL CHECK (amount_cup > 0),
  period_days     INTEGER NOT NULL CHECK (period_days BETWEEN 1 AND 365),
  method          TEXT NOT NULL CHECK (method IN ('efectivo', 'transferencia')),
  reference       TEXT,
  kind            TEXT NOT NULL DEFAULT 'alta' CHECK (kind IN ('alta', 'renovacion')),
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
  confirmed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_pendientes
  ON plan_payments (created_at ASC) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_pagos_por_suscripcion
  ON plan_payments (subscription_id, created_at DESC);
