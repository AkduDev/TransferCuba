-- Migración 1.9 — DROP de columnas legacy de `businesses` ya cubiertas por V2.
-- Cierra V2_REFACTOR_PLAN.md §1.9. Idempotente: seguro de re-ejecutar.
--
-- Se eliminan SOLO las columnas cuyo dato real vive en tablas normalizadas:
--   transfer_details → business_payment_methods (47 relaciones)
--   featured         → business_promotions (5 promociones featured)
--   photos           → business_images (0 filas; fotos localistas ausentes)
-- Se MANTIENEN como cache denormalizada (patrón read-heavy, plano):
--   hours (texto curado por negocio no reproducible desde business_hours),
--   confirmations_count, reports_count, rating, reviews_count
--   (tablas de eventos vacías; el dato real vive en estos contadores).
BEGIN;

ALTER TABLE businesses DROP COLUMN IF EXISTS transfer_details;
ALTER TABLE businesses DROP COLUMN IF EXISTS featured;
ALTER TABLE businesses DROP COLUMN IF EXISTS photos;

-- El índice de soporte de ORDER BY featured DESC pierde su columna.
DROP INDEX IF EXISTS idx_businesses_featured;

COMMIT;