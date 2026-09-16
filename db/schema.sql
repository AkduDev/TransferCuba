-- TransferCuba businesses schema
-- Generado para migración de INITIAL_BUSINESSES a PostGIS (Sprint 10)

-- Extensión PostGIS requerida
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla principal de negocios
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    category_icon TEXT NOT NULL,
    description TEXT NOT NULL,
    province TEXT NOT NULL,
    municipality TEXT NOT NULL,
    neighborhood TEXT,
    address TEXT NOT NULL,
    whatsapp TEXT,
    phone TEXT,
    hours TEXT NOT NULL,
    transfer_details JSONB NOT NULL,
    accepts_transfer BOOLEAN NOT NULL DEFAULT false,
    transfer_active_now BOOLEAN NOT NULL DEFAULT false,
    transfer_verified BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'rejected')),
    confirmations_count INTEGER NOT NULL DEFAULT 0,
    reports_count INTEGER NOT NULL DEFAULT 0,
    rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    featured BOOLEAN NOT NULL DEFAULT false,
    photos TEXT[] NOT NULL DEFAULT '{}',
    last_status_update TEXT NOT NULL,
    last_updated_date TIMESTAMPTZ NOT NULL,
    geom geography(POINT, 4326) NOT NULL
);

-- Índices canónicos (sin duplicados — Sprint 11 / Fase 0)
CREATE INDEX IF NOT EXISTS businesses_geom_gist ON businesses USING GIST (geom);
CREATE INDEX IF NOT EXISTS businesses_status ON businesses (status);
CREATE INDEX IF NOT EXISTS businesses_status_province_municipality ON businesses (status, province, municipality);
CREATE INDEX IF NOT EXISTS businesses_status_category ON businesses (status, category);
CREATE INDEX IF NOT EXISTS businesses_active_now ON businesses (status, transfer_active_now) WHERE status = 'active';

-- Índice soporte orden por destacado (USO real: ORDER BY featured DESC, rating DESC)
CREATE INDEX IF NOT EXISTS idx_businesses_featured ON businesses (featured);

-- Nota: index de rating eliminado (0 scans, las queries principales son geográficas)