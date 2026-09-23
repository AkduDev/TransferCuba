-- Migración: get_businesses_mvt con campos para filtros de capa y badges
-- (has_delivery, qr_payment, online_payment). Idempotente (CREATE OR REPLACE).

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
        4096, 256, true
      ) AS geom
    FROM businesses b
    WHERE b.geom && ST_Transform(ST_TileEnvelope(z, x, y), 4326)::geography
      AND b.status = 'active'
  ) AS tile
$$;
