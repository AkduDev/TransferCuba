-- TransferCuba — «destacar en el mapa» servido por los planes (Fase 3).
--
-- Hasta ahora `featured` salía solo de `business_promotions`, y los planes lo
-- prometen también. Dos sitios calculando lo mismo acaban divergiendo, así que
-- la regla vive en UNA vista que consultan tanto el DAO como la función MVT.
--
-- Se destaca un negocio si se cumple cualquiera de las dos:
--   · Una promoción manual viva. Se conserva a propósito: el administrador
--     necesita poder destacar sin cobrar (un socio, una compensación).
--   · Una suscripción ACTIVA cuyo plan incluya 'featured' — la del propio
--     negocio, o la cuenta premium de su dueño.
--
-- Idempotente.

CREATE OR REPLACE VIEW business_featured AS
SELECT
  b.id AS business_id,
  (
    EXISTS (
      SELECT 1 FROM business_promotions bp
      WHERE bp.business_id = b.id
        AND bp.type = 'featured'
        AND bp.active
        AND (bp.ends_at IS NULL OR bp.ends_at > NOW())
    )
    OR EXISTS (
      SELECT 1
      FROM plan_subscriptions s
      JOIN plans pl ON pl.code = s.plan_code
      WHERE s.status = 'ACTIVE'
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
        AND 'featured' = ANY (pl.features)
        AND (
          (pl.scope = 'BUSINESS' AND s.business_id = b.id)
          OR (pl.scope = 'ACCOUNT' AND b.owner_user_id = s.user_id)
        )
    )
  ) AS featured
FROM businesses b;

-- La tesela pasa a llevar `featured` para que el mapa pueda pintarlo distinto.
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
      COALESCE(f.featured, FALSE) AS featured,
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
    LEFT JOIN business_featured f ON f.business_id = b.id
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
