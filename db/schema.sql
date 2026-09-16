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

/* ===================== Modelo V2 — tablas normalizadas =====================
   Sprint 2 (V2_REFACTOR_PLAN.md). Las columnas legacy de `businesses`
   (photos, hours, transfer_details, featured, *_count, rating) se MANTIENEN
   como cache de solo-lectura hasta el Sprint 3 (cutover del DAO a estas
   tablas). No eliminar ninguna columna legacy hasta ese punto.
============================================================================= */

-- 1.1 Imágenes de negocio (fotos → tabla)
CREATE TABLE IF NOT EXISTS business_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    alt TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_images_business ON business_images (business_id);

-- 1.2 Horarios normalizados (hours text → tabla)
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_business_hours_business ON business_hours (business_id);

-- 1.3 Catálogo de métodos de pago + relación negocio-método
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO payment_methods (id, name, slug, icon)
VALUES
    ('00000000-0000-4000-8000-000000000001', 'Transfermóvil', 'transfermovil', 'Smartphone'),
    ('00000000-0000-4000-8000-000000000002', 'EnZona', 'enzona', 'Zap'),
    ('00000000-0000-4000-8000-000000000003', 'Pago QR', 'qr', 'QrCode'),
    ('00000000-0000-4000-8000-000000000004', 'Efectivo', 'cash', 'Banknote'),
    ('00000000-0000-4000-8000-000000000005', 'Pago online', 'onlineGateway', 'CreditCard')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS business_payment_methods (
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (business_id, payment_method_id)
);
CREATE INDEX IF NOT EXISTS idx_bpm_method ON business_payment_methods (payment_method_id);

-- 1.4 Reportes (reports_count → tabla)
CREATE TABLE IF NOT EXISTS business_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_session TEXT,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'closed', 'misleading', 'other')),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_business_reports_business ON business_reports (business_id);
CREATE INDEX IF NOT EXISTS idx_business_reports_status ON business_reports (status) WHERE status = 'pending';

-- 1.5 Verificaciones (transfer_verified como cache de estas filas válidas)
CREATE TABLE IF NOT EXISTS business_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_session TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE (business_id, user_session)
);
CREATE INDEX IF NOT EXISTS idx_business_verifications_business ON business_verifications (business_id);

-- 1.6 Confirmaciones (confirmations_count → tabla, máx. 1/usuario/día)
CREATE TABLE IF NOT EXISTS business_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_session TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, user_session, created_at)
);
CREATE INDEX IF NOT EXISTS idx_business_confirmations_business ON business_confirmations (business_id);

-- 1.7 Reviews (futuro; rating/reviews_count pasan a agregado bajo demanda)
CREATE TABLE IF NOT EXISTS business_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    user_session TEXT,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'removed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_reviews_business ON business_reviews (business_id);

-- 1.8 Promociones (featured → promociones)
CREATE TABLE IF NOT EXISTS business_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('featured', 'sponsored', 'promo')),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    priority INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_promotions_business ON business_promotions (business_id);
CREATE INDEX IF NOT EXISTS idx_business_promotions_active
    ON business_promotions (business_id) WHERE active = TRUE AND ends_at IS NULL OR ends_at > NOW();