-- TransferCuba — seed inicial
-- Generado desde INITIAL_BUSINESSES (lib/cuba-data.ts).
-- Ejecutar DESPUÉS de db/schema.sql.

BEGIN;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-1', 'La Esquina Market', 'tiendas', 'ShoppingBag',
  'Minisupermercado con amplia variedad de víveres, enlatados, confituras, lácteos y productos de higiene.', 'La Habana', 'Plaza de la Revolución',
  'Vedado',
  'Calle 23 #123 e/ L y M, Vedado', '+5352849102', '+5378321045', '08:00 — 21:00 (Lunes a Domingo)',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":true,"cash":true}'::jsonb, true, true,
  true, 'active', 48, 1,
  4.8, 64, true, '[]'::jsonb,
  'Hace 12 min', '2026-09-10T00:05:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.3855, 23.1382), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-2', 'Pizzería & Trattoria Bella Napoli', 'comida', 'Utensils',
  'Pizzas artesanales al horno de leña, pastas frescas y bebidas frías. Servicio en mesa y para llevar.', 'La Habana', 'Habana Vieja',
  'Centro Histórico',
  'Calle Obispo #358 e/ Habana y Compostela', '+5353119842', '+5378624410', '11:30 — 23:00',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  true, 'active', 32, 0,
  4.7, 51, true, '[]'::jsonb,
  'Hace 35 min', '2026-09-09T23:42:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.3551, 23.1389), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-3', 'Taller TechHabana Fix', 'servicios', 'Smartphone',
  'Reparación especializada de móviles iPhone, Samsung y Xiaomi. Cambio de pantallas, baterías y accesorios.', 'La Habana', 'Centro Habana',
  'San Rafael',
  'Bulevar de San Rafael #204 e/ Águila y Galiano', '+5354920193', '+5378679021', '09:00 — 18:00 (Lunes a Sábado)',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  true, 'active', 29, 0,
  4.9, 38, false, '[]'::jsonb,
  'Hace 1 hora', '2026-09-09T23:17:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.3615, 23.1374), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-4', 'Farmacia & Óptica San Lázaro', 'farmacias', 'Pill',
  'Medicamentos autorizados, suplementos, insumos sanitarios de primera necesidad y artículos para bebé.', 'La Habana', 'Centro Habana',
  'Cayo Hueso',
  'Calle San Lázaro #610 esq. Belascoaín', '+5352109844', '+5378783011', '08:30 — 19:00',
  '{"transfermovil":true,"enzona":false,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  true, 'active', 65, 2,
  4.6, 42, false, '[]'::jsonb,
  'Hace 2 horas', '2026-09-09T22:17:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.3702, 23.1415), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-5', 'Cafetería & Panadería El Prado', 'cafeterias', 'Coffee',
  'Pan recién horneado, dulces finos, café expreso cubano, sándwiches tostados y jugos naturales.', 'La Habana', 'Habana Vieja',
  'Paseo del Prado',
  'Paseo de Martí (Prado) #452 e/ San Rafael y San José', '+5353891024', '+5378619940', '07:30 — 22:00',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  true, 'active', 54, 0,
  4.8, 77, true, '[]'::jsonb,
  'Hace 15 min', '2026-09-10T00:02:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.3592, 23.1362), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-6', 'Ferretería El Tornillo Feliz', 'ferreteria', 'Wrench',
  'Materiales eléctricos, tuberías plásticas, herramientas manuales, tornillería, bombillos LED y pintura.', 'La Habana', 'Diez de Octubre',
  'Santos Suárez',
  'Calzada de 10 de Octubre #842 e/ Santa Irene y San Mariano', '+5352667788', '+5376402219', '08:30 — 17:00 (Lunes a Sábado)',
  '{"transfermovil":true,"enzona":false,"qrPayment":false,"onlineGateway":false,"cash":true}'::jsonb, true, false,
  true, 'active', 18, 5,
  4.3, 22, false, '[]'::jsonb,
  'Hace 40 min', '2026-09-09T23:37:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.3688, 23.0995), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-7', 'Agromercado & Frutas 19 y B', 'tiendas', 'ShoppingBag',
  'Viandas frescas, vegetales, frutas de estación, carnes limpias y condimentos del campo cubano.', 'La Habana', 'Plaza de la Revolución',
  'Vedado',
  'Calle 19 esq. a Calle B, Vedado', '+5354019283', '+5378304412', '07:30 — 16:30',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  true, 'active', 88, 1,
  4.7, 93, true, '[]'::jsonb,
  'Hace 5 min', '2026-09-10T00:12:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.3921, 23.1432), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-8', 'Boutique & Calzado Miramar Style', 'ropa', 'Shirt',
  'Prendas de vestir casuales, calzado deportivo importado, mochilas, carteras y accesorios.', 'La Habana', 'Playa',
  'Miramar',
  'Avenida 3ra #4208 e/ 42 y 44, Miramar', '+5353112233', '+5372049988', '10:00 — 19:00',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":true,"cash":true}'::jsonb, true, true,
  true, 'active', 31, 0,
  4.9, 34, false, '[]'::jsonb,
  'Hace 45 min', '2026-09-09T23:32:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.4219, 23.1235), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-9', 'Restaurante El Rincón Holguinero', 'comida', 'Utensils',
  'Comida criolla oriental, lechón asado, congrí tradicional, tostones rellenos y coctelería nacional.', 'Holguín', 'Holguín',
  'Centro',
  'Calle Maceo #184 e/ Martí y Luz Caballero', '+5352994411', '+5324423311', '12:00 — 23:00',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  true, 'active', 41, 0,
  4.8, 45, true, '[]'::jsonb,
  'Hace 20 min', '2026-09-09T23:57:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-76.2625, 20.8885), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-10', 'Farmacia San Antonio Santiago', 'farmacias', 'Pill',
  'Farmacia con atención esmerada, medicamentos autorizados y medicina natural y tradicional.', 'Santiago de Cuba', 'Santiago de Cuba',
  'Centro Histórico',
  'Calle Enramadas #302 esq. Carnicería', '+5353887711', '+5322651122', '08:00 — 20:00',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  true, 'active', 52, 1,
  4.6, 39, false, '[]'::jsonb,
  'Hace 1 hora', '2026-09-09T23:17:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-75.8279, 20.0215), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-11', 'Minimarket La Bahía Matanzas', 'tiendas', 'ShoppingBag',
  'Abarrotes, enlatados, confitería, artículos de limpieza para el hogar y bebidas.', 'Matanzas', 'Matanzas',
  'Pueblo Nuevo',
  'Calle Milanés #54 e/ 2 de Mayo y Manzaneda', '+5352441100', '+5345241199', '08:30 — 20:00',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  true, 'active', 27, 0,
  4.5, 23, false, '[]'::jsonb,
  'Hace 10 min', '2026-09-10T00:07:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-81.5761, 23.0425), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
INSERT INTO businesses (
  id, name, category, category_icon, description, province, municipality,
  neighborhood, address, whatsapp, phone, hours, transfer_details,
  accepts_transfer, transfer_active_now, transfer_verified, status,
  confirmations_count, reports_count, rating, reviews_count, featured,
  photos, last_status_update, last_updated_date, geom
) VALUES (
  'biz-pending-demo', 'Cafetería & Desayunos El Malecón', 'cafeterias', 'Coffee',
  'Café cubano expreso, sándwiches tostados, batidos naturales y repostería artesanal recién horneada.', 'La Habana', 'Plaza de la Revolución',
  'Vedado',
  'Calle Línea esq. Malecón #102', '+5353123456', '+5378330012', '07:30 — 19:00',
  '{"transfermovil":true,"enzona":true,"qrPayment":true,"onlineGateway":false,"cash":true}'::jsonb, true, true,
  false, 'pending', 1, 0,
  4.9, 2, false, '[]'::jsonb,
  'Enviado recientemente (Pendiente de aprobación)', '2026-09-10T00:17:34.439Z'::timestamptz,
  ST_SetSRID(ST_MakePoint(-82.401, 23.1415), 4326)::geography
) ON CONFLICT (id) DO NOTHING;
COMMIT;
