-- Migración V2 — backfill de tablas normalizadas desde columnas legacy.
-- Sprint 2 (V2_REFACTOR_PLAN.md, Fase 1). Idempotente: seguro de re-ejecutar.
--
-- OBJETIVO HISTÓRICO: aplica SOLO a bases de datos creadas ANTES de 1.9
-- (schema con columnas legacy transfer_details/featured/photos). Para
-- instalaciones nuevas, schema.sql → seed.sql ya siembran las tablas V2
-- directamente y estas columnas ya no existen en `businesses`.
BEGIN;

/* ---- 1.3 Métodos de pago de cada negocio (transfer_details jsonb → tabla) ----
   Slugs legacy: transfermovil, enzona, qrPayment, onlineGateway, cash.
   Slugs V2:      transfermovil, enzona, qr, onlineGateway, cash. (qrPayment ← qr) */
INSERT INTO business_payment_methods (business_id, payment_method_id, is_active)
SELECT
    b.id,
    pm.id,
    (b.transfer_details ->> CASE
        WHEN pm.slug = 'qr' THEN 'qrPayment'
        ELSE pm.slug
    END)::boolean
FROM businesses b
JOIN payment_methods pm ON TRUE
WHERE b.transfer_details ? CASE
        WHEN pm.slug = 'qr' THEN 'qrPayment'
        ELSE pm.slug
    END
  AND (b.transfer_details ->> CASE
        WHEN pm.slug = 'qr' THEN 'qrPayment'
        ELSE pm.slug
    END)::boolean
ON CONFLICT (business_id, payment_method_id) DO NOTHING;

/* ---- 1.8 Promociones (featured → promoción 'featured') ---- */
INSERT INTO business_promotions (business_id, type, active)
SELECT id, 'featured', TRUE FROM businesses WHERE featured = TRUE
ON CONFLICT DO NOTHING;

/* ---- 1.5 Verificaciones (transfer_verified → 1 verificación activa vigente) ----
   Sin auth no hay user_session real; guardamos 'seed' como session sintética
   para que el conteo derivado sea correcto hasta que exista identidad. */
INSERT INTO business_verifications (business_id, user_session, expires_at)
SELECT id, 'seed', NOW() + INTERVAL '12 months'
FROM businesses
WHERE transfer_verified = TRUE
ON CONFLICT (business_id, user_session) DO NOTHING;

/* ---- 1.1 Imágenes (photos jsonb → tabla) ----
   Necesita un id tipo UUID; las columnas `sort_order`/`is_cover` se derivan. */
INSERT INTO business_images (business_id, url, sort_order, is_cover)
SELECT
    b.id,
    elem.value,
    elem.ordinality - 1,
    elem.ordinality = 1
FROM businesses b
CROSS JOIN LATERAL jsonb_array_elements_text(b.photos) WITH ORDINALITY AS elem
WHERE jsonb_array_length(b.photos) > 0;

/* ---- 1.2 Horarios (hours text → filas L-V 8:30-18:00 por defecto) ----
   El texto libre cubano ("08:00 — 21:00 (Lunes a Domingo)") no se parsea de
   forma fiable; se siembra el horario estándar y se pule por negocio luego. */
INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at)
SELECT
    b.id,
    dow,
    '08:30'::time,
    '18:00'::time
FROM businesses b
CROSS JOIN generate_series(0, 6) AS dow
ON CONFLICT (business_id, day_of_week) DO NOTHING;

COMMIT;