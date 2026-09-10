-- TransferCuba — esquema PostgreSQL + PostGIS
-- Sprint 2 del roadmap (docs/roadmap.md)

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  category_icon TEXT NOT NULL DEFAULT '🏪',
  description TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL,
  municipality TEXT NOT NULL,
  neighborhood TEXT,
  address TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT '8:30 AM - 6:00 PM',
  transfer_details JSONB NOT NULL DEFAULT '{
    "transfermovil": true, "enzona": false, "qrPayment": false,
    "onlineGateway": false, "cash": true
  }'::jsonb,
  accepts_transfer BOOLEAN NOT NULL DEFAULT true,
  transfer_active_now BOOLEAN NOT NULL DEFAULT true,
  transfer_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('active', 'pending', 'rejected')),
  confirmations_count INT NOT NULL DEFAULT 0,
  reports_count INT NOT NULL DEFAULT 0,
  rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  reviews_count INT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_status_update TEXT NOT NULL DEFAULT 'Registrado recientemente',
  last_updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Columna geoespacial: geography (metros reales para ST_DWithin/ST_Distance)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);

-- Genera geography desde lat/lng stored columns cuando se insertan/actualizan
-- lat y lng NO se almacenan en columnas aparte; la app pasa lat/lng al driver.

-- Índice espacial GIST — acelera bbox && y ST_DWithin en órdenes de magnitud
CREATE INDEX IF NOT EXISTS businesses_geom_gist
  ON businesses USING GIST (geom);

-- Índices de filtrado del dominio
CREATE INDEX IF NOT EXISTS businesses_status_province_municipality
  ON businesses (status, province, municipality);
CREATE INDEX IF NOT EXISTS businesses_status_category
  ON businesses (status, category);
CREATE INDEX IF NOT EXISTS businesses_active_now
  ON businesses (status, transfer_active_now) WHERE status = 'active';
