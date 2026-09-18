-- TransferCuba — corrección del índice de promociones.
--
-- El índice original de db/schema.sql era:
--
--   CREATE INDEX idx_business_promotions_active
--     ON business_promotions (business_id)
--     WHERE active = TRUE AND ends_at IS NULL OR ends_at > NOW();
--
-- Tenía tres problemas:
--
--  1. NOW() no es IMMUTABLE, así que PostgreSQL rechaza la sentencia
--     ("functions in index predicate must be marked IMMUTABLE"). Verificado en
--     PostgreSQL 16 limpio: db/schema.sql abortaba en esa línea y todo lo
--     posterior (incluida la función get_businesses_mvt) se quedaba sin crear.
--  2. Precedencia: AND liga más que OR, así que el predicado se agrupaba como
--     (active = TRUE AND ends_at IS NULL) OR (ends_at > NOW()), que incluye
--     promociones inactivas con fecha futura. No era la intención.
--  3. No servía a ninguna consulta real: las dos subconsultas de `featured` en
--     lib/db.ts no filtran por `active`, lo devuelven como valor.
--
-- Idempotente. Si el índice viejo nunca llegó a existir (lo normal, porque la
-- sentencia fallaba), el DROP no hace nada.

DROP INDEX IF EXISTS idx_business_promotions_active;

CREATE INDEX IF NOT EXISTS idx_business_promotions_featured
    ON business_promotions (business_id, type, priority DESC, ends_at);
