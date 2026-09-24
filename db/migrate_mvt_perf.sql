-- Migración: rendimiento de tiles MVT (buffer 96, label + payment_codes,
-- índice compuesto de métodos de pago). Idempotente.

CREATE INDEX IF NOT EXISTS idx_bpm_business_method_active
  ON business_payment_methods (business_id, payment_method_id) WHERE is_active;

CREATE OR REPLACE FUNCTION get_businesses_mvt(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql
STABLE
AS $$
  SELECT ST_AsMVT(tile, 'businesses', 4096, 'geom')
  FROM (
    SELECT
      b.id, b.name, b.category, b.category_icon,
      b.province, b.municipality, b.accepts_transfer, b.transfer_active_now,
      b.transfer_verified, b.rating, b.has_delivery,
      (b.name || ' ' || CASE b.category
        WHEN 'comida' THEN '🍔'
        WHEN 'tiendas' THEN '🛒'
        WHEN 'farmacias' THEN '💊'
        WHEN 'cafeterias' THEN '☕'
        WHEN 'servicios' THEN '🔧'
        WHEN 'ferreteria' THEN '🏠'
        WHEN 'ropa' THEN '👕'
        ELSE '🏪' END) AS label,
      COALESCE(pay.payment_codes, '') AS payment_codes,
      CASE WHEN b.reports_count > 0 THEN 'reported'
           WHEN b.transfer_verified THEN 'verified'
           ELSE 'pending' END AS status,
      EXISTS (
        SELECT 1 FROM business_payment_methods bpm
        JOIN payment_methods pm ON pm.id = bpm.payment_method_id
        WHERE bpm.business_id = b.id AND pm.slug = 'qr' AND bpm.is_active
      ) AS qr_payment,
      EXISTS (
        SELECT 1 FROM business_payment_methods bpm
        JOIN payment_methods pm ON pm.id = bpm.payment_method_id
        WHERE bpm.business_id = b.id AND pm.slug = 'onlineGateway' AND bpm.is_active
      ) AS online_payment,
      ST_AsMVTGeom(
        ST_Transform(b.geom::geometry, 3857),
        ST_TileEnvelope(z, x, y),
        4096, 96, true
      ) AS geom
    FROM businesses b
    LEFT JOIN LATERAL (
      SELECT string_agg(
        CASE pm.slug
          WHEN 'transfermovil' THEN 'TM'
          WHEN 'enzona' THEN 'EZ'
          WHEN 'qr' THEN 'QR'
          WHEN 'onlineGateway' THEN 'Online'
          WHEN 'cash' THEN 'Cash'
        END, ' ' ORDER BY
          CASE pm.slug
            WHEN 'transfermovil' THEN 1
            WHEN 'enzona' THEN 2
            WHEN 'qr' THEN 3
            WHEN 'onlineGateway' THEN 4
            WHEN 'cash' THEN 5
            ELSE 6
          END
      ) AS payment_codes
      FROM business_payment_methods bpm
      JOIN payment_methods pm ON pm.id = bpm.payment_method_id
      WHERE bpm.business_id = b.id AND bpm.is_active
    ) pay ON true
    WHERE b.geom && ST_Transform(ST_TileEnvelope(z, x, y), 4326)::geography
      AND b.status = 'active'
  ) AS tile
$$;
