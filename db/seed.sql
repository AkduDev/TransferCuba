-- Seed data for businesses table + tablas V2.
-- Generated from INITIAL_BUSINESSES (12 negocios).
-- Compatible con 'db/schema.sql': requiere postgis + tabla businesses.
-- Desde 1.9 las columnas legacy (transfer_details, featured, photos) ya no
-- existen; el DAO reconstruye esos campos desde las tablas normalizadas V2,
-- que se siembran aquí directamente (misma data que el backfill legacy).
-- Fresh install: schema.sql → seed.sql.
BEGIN;

INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-1', 'La Esquina Market', 'tiendas', 'ShoppingBag', 'Minisupermercado con amplia variedad de víveres, enlatados, confituras, lácteos y productos de higiene.', 'La Habana', 'Plaza de la Revolución', 'Vedado', 'Calle 23 #123 e/ L y M, Vedado', '+5352849102', '+5378321045', '08:00 — 21:00 (Lunes a Domingo)', TRUE, TRUE, TRUE, 'active', 48, 1, 4.8, 64, 'Hace 12 min', '2026-09-16T12:52:01.705Z', ST_SetSRID(ST_MakePoint(-82.3855, 23.1382), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-2', 'Pizzería & Trattoria Bella Napoli', 'comida', 'Utensils', 'Pizzas artesanales al horno de leña, pastas frescas y bebidas frías. Servicio en mesa y para llevar.', 'La Habana', 'Habana Vieja', 'Centro Histórico', 'Calle Obispo #358 e/ Habana y Compostela', '+5353119842', '+5378624410', '11:30 — 23:00', TRUE, TRUE, TRUE, 'active', 32, 0, 4.7, 51, 'Hace 35 min', '2026-09-16T12:29:01.705Z', ST_SetSRID(ST_MakePoint(-82.3551, 23.1389), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-3', 'Taller TechHabana Fix', 'servicios', 'Smartphone', 'Reparación especializada de móviles iPhone, Samsung y Xiaomi. Cambio de pantallas, baterías y accesorios.', 'La Habana', 'Centro Habana', 'San Rafael', 'Bulevar de San Rafael #204 e/ Águila y Galiano', '+5354920193', '+5378679021', '09:00 — 18:00 (Lunes a Sábado)', TRUE, TRUE, TRUE, 'active', 29, 0, 4.9, 38, 'Hace 1 hora', '2026-09-16T12:04:01.706Z', ST_SetSRID(ST_MakePoint(-82.3615, 23.1374), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-4', 'Farmacia & Óptica San Lázaro', 'farmacias', 'Pill', 'Medicamentos autorizados, suplementos, insumos sanitarios de primera necesidad y artículos para bebé.', 'La Habana', 'Centro Habana', 'Cayo Hueso', 'Calle San Lázaro #610 esq. Belascoaín', '+5352109844', '+5378783011', '08:30 — 19:00', TRUE, TRUE, TRUE, 'active', 65, 2, 4.6, 42, 'Hace 2 horas', '2026-09-16T11:04:01.706Z', ST_SetSRID(ST_MakePoint(-82.3702, 23.1415), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-5', 'Cafetería & Panadería El Prado', 'cafeterias', 'Coffee', 'Pan recién horneado, dulces finos, café expreso cubano, sándwiches tostados y jugos naturales.', 'La Habana', 'Habana Vieja', 'Paseo del Prado', 'Paseo de Martí (Prado) #452 e/ San Rafael y San José', '+5353891024', '+5378619940', '07:30 — 22:00', TRUE, TRUE, TRUE, 'active', 54, 0, 4.8, 77, 'Hace 15 min', '2026-09-16T12:49:01.706Z', ST_SetSRID(ST_MakePoint(-82.3592, 23.1362), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-6', 'Ferretería El Tornillo Feliz', 'ferreteria', 'Wrench', 'Materiales eléctricos, tuberías plásticas, herramientas manuales, tornillería, bombillos LED y pintura.', 'La Habana', 'Diez de Octubre', 'Santos Suárez', 'Calzada de 10 de Octubre #842 e/ Santa Irene y San Mariano', '+5352667788', '+5376402219', '08:30 — 17:00 (Lunes a Sábado)', TRUE, FALSE, TRUE, 'active', 18, 5, 4.3, 22, 'Hace 40 min', '2026-09-16T12:24:01.706Z', ST_SetSRID(ST_MakePoint(-82.3688, 23.0995), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-7', 'Agromercado & Frutas 19 y B', 'tiendas', 'ShoppingBag', 'Viandas frescas, vegetales, frutas de estación, carnes limpias y condimentos del campo cubano.', 'La Habana', 'Plaza de la Revolución', 'Vedado', 'Calle 19 esq. a Calle B, Vedado', '+5354019283', '+5378304412', '07:30 — 16:30', TRUE, TRUE, TRUE, 'active', 88, 1, 4.7, 93, 'Hace 5 min', '2026-09-16T12:59:01.706Z', ST_SetSRID(ST_MakePoint(-82.3921, 23.1432), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-8', 'Boutique & Calzado Miramar Style', 'ropa', 'Shirt', 'Prendas de vestir casuales, calzado deportivo importado, mochilas, carteras y accesorios.', 'La Habana', 'Playa', 'Miramar', 'Avenida 3ra #4208 e/ 42 y 44, Miramar', '+5353112233', '+5372049988', '10:00 — 19:00', TRUE, TRUE, TRUE, 'active', 31, 0, 4.9, 34, 'Hace 45 min', '2026-09-16T12:19:01.706Z', ST_SetSRID(ST_MakePoint(-82.4219, 23.1235), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-9', 'Restaurante El Rincón Holguinero', 'comida', 'Utensils', 'Comida criolla oriental, lechón asado, congrí tradicional, tostones rellenos y coctelería nacional.', 'Holguín', 'Holguín', 'Centro', 'Calle Maceo #184 e/ Martí y Luz Caballero', '+5352994411', '+5324423311', '12:00 — 23:00', TRUE, TRUE, TRUE, 'active', 41, 0, 4.8, 45, 'Hace 20 min', '2026-09-16T12:44:01.706Z', ST_SetSRID(ST_MakePoint(-76.2625, 20.8885), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-10', 'Farmacia San Antonio Santiago', 'farmacias', 'Pill', 'Farmacia con atención esmerada, medicamentos autorizados y medicina natural y tradicional.', 'Santiago de Cuba', 'Santiago de Cuba', 'Centro Histórico', 'Calle Enramadas #302 esq. Carnicería', '+5353887711', '+5322651122', '08:00 — 20:00', TRUE, TRUE, TRUE, 'active', 52, 1, 4.6, 39, 'Hace 1 hora', '2026-09-16T12:04:01.706Z', ST_SetSRID(ST_MakePoint(-75.8279, 20.0215), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-11', 'Minimarket La Bahía Matanzas', 'tiendas', 'ShoppingBag', 'Abarrotes, enlatados, confitería, artículos de limpieza para el hogar y bebidas.', 'Matanzas', 'Matanzas', 'Pueblo Nuevo', 'Calle Milanés #54 e/ 2 de Mayo y Manzaneda', '+5352441100', '+5345241199', '08:30 — 20:00', TRUE, TRUE, TRUE, 'active', 27, 0, 4.5, 23, 'Hace 10 min', '2026-09-16T12:54:01.706Z', ST_SetSRID(ST_MakePoint(-81.5761, 23.0425), 4326)::geography);
INSERT INTO businesses (id, name, category, category_icon, description, province, municipality, neighborhood, address, whatsapp, phone, hours, accepts_transfer, transfer_active_now, transfer_verified, status, confirmations_count, reports_count, rating, reviews_count, last_status_update, last_updated_date, geom) VALUES ('biz-pending-demo', 'Cafetería & Desayunos El Malecón', 'cafeterias', 'Coffee', 'Café cubano expreso, sándwiches tostados, batidos naturales y repostería artesanal recién horneada.', 'La Habana', 'Plaza de la Revolución', 'Vedado', 'Calle Línea esq. Malecón #102', '+5353123456', '+5378330012', '07:30 — 19:00', TRUE, TRUE, FALSE, 'pending', 1, 0, 4.9, 2, 'Enviado recientemente (Pendiente de aprobación)', '2026-09-16T13:04:01.706Z', ST_SetSRID(ST_MakePoint(-82.401, 23.1415), 4326)::geography);

/* ==================== Tablas V2 (seed directo, ver schema.sql) ==================== */

-- 1.3 Métodos de pago por negocio (mismos booleans del seed legacy, 47 relaciones).
INSERT INTO business_payment_methods (business_id, payment_method_id)
SELECT x.business_id, pm.id
FROM (VALUES
    ('biz-1','transfermovil'), ('biz-1','enzona'), ('biz-1','qr'), ('biz-1','onlineGateway'), ('biz-1','cash'),
    ('biz-2','transfermovil'), ('biz-2','enzona'), ('biz-2','qr'), ('biz-2','cash'),
    ('biz-3','transfermovil'), ('biz-3','enzona'), ('biz-3','qr'), ('biz-3','cash'),
    ('biz-4','transfermovil'), ('biz-4','qr'), ('biz-4','cash'),
    ('biz-5','transfermovil'), ('biz-5','enzona'), ('biz-5','qr'), ('biz-5','cash'),
    ('biz-6','transfermovil'), ('biz-6','cash'),
    ('biz-7','transfermovil'), ('biz-7','enzona'), ('biz-7','qr'), ('biz-7','cash'),
    ('biz-8','transfermovil'), ('biz-8','enzona'), ('biz-8','qr'), ('biz-8','onlineGateway'), ('biz-8','cash'),
    ('biz-9','transfermovil'), ('biz-9','enzona'), ('biz-9','qr'), ('biz-9','cash'),
    ('biz-10','transfermovil'), ('biz-10','enzona'), ('biz-10','qr'), ('biz-10','cash'),
    ('biz-11','transfermovil'), ('biz-11','enzona'), ('biz-11','qr'), ('biz-11','cash'),
    ('biz-pending-demo','transfermovil'), ('biz-pending-demo','enzona'), ('biz-pending-demo','qr'), ('biz-pending-demo','cash')
) AS x(business_id, slug)
JOIN businesses b ON b.id = x.business_id
JOIN payment_methods pm ON pm.slug = x.slug
ON CONFLICT (business_id, payment_method_id) DO NOTHING;

-- 1.8 Promociones featured para los negocios destacados del seed.
INSERT INTO business_promotions (business_id, type, active)
SELECT id, 'featured', TRUE
FROM businesses
WHERE id IN ('biz-1','biz-2','biz-5','biz-7','biz-9')
ON CONFLICT DO NOTHING;

-- 1.5 Verificaciones sintéticas para los negocios transfer_verified.
INSERT INTO business_verifications (business_id, user_session, expires_at)
SELECT id, 'seed', NOW() + INTERVAL '12 months'
FROM businesses
WHERE transfer_verified = TRUE
ON CONFLICT (business_id, user_session) DO NOTHING;

-- 1.2 Horarios estándar L-D 08:30-18:00 para todos (se pulen por negocio luego).
INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at)
SELECT b.id, dow, '08:30'::time, '18:00'::time
FROM businesses b
CROSS JOIN generate_series(0, 6) AS dow
ON CONFLICT (business_id, day_of_week) DO NOTHING;

COMMIT;