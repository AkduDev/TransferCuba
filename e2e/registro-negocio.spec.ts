import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';

/**
 * Alta de negocio y sus fotos.
 *
 * Esto no tenía ninguna prueba, y por eso pasó desapercibido que el alta
 * fallaba SIEMPRE contra una base creada desde `db/schema.sql`:
 * `last_updated_date` es NOT NULL y no viajaba en el INSERT, el error de
 * restricción se confundía con una caída de PostgreSQL y la API respondía 201
 * sin haber guardado nada. El usuario veía "registrado" y no existía.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

const FOTO_VALIDA = 'https://res.cloudinary.com/demo/image/upload/v1/businesses/foto1.jpg';

function negocio(extra: Record<string, unknown> = {}) {
  return {
    name: `Cafetería E2E ${Date.now()}`,
    category: 'cafeterias',
    categoryIcon: 'Coffee',
    description: 'Negocio de prueba creado por la suite end-to-end',
    province: 'La Habana',
    municipality: 'Plaza de la Revolución',
    address: 'Calle 23 #100 e/ L y M',
    whatsapp: '+5355512345',
    phone: '+5355512345',
    hours: '9:00 — 17:00',
    acceptsTransfer: true,
    lat: 23.1385,
    lng: -82.3842,
    ...extra
  };
}

test('el alta persiste de verdad, no solo responde 201', async ({ request }) => {
  const res = await request.post('/api/businesses', { data: negocio() });
  expect(res.status(), await res.text()).toBe(201);
  const { business } = (await res.json()) as { business: { id: string } };

  // La comprobación que faltaba: volver a leerlo. Antes el 201 era un 201
  // vacío — el negocio se quedaba en un array en memoria del proceso.
  const leido = await request.get(`/api/businesses/${business.id}`);
  expect(leido.status(), 'el negocio no llegó a la base de datos').toBe(200);
});

test('solo se guardan fotos del host permitido', async ({ request }) => {
  const res = await request.post('/api/businesses', {
    data: negocio({
      photos: [
        FOTO_VALIDA,
        'https://loquesea.com/pirata.jpg',
        'https://images.unsplash.com/robada.jpg',
        'no-es-una-url',
        'http://res.cloudinary.com/demo/image/upload/v1/sin-tls.jpg'
      ]
    })
  });
  expect(res.status(), await res.text()).toBe(201);

  const { business } = (await res.json()) as { business: { id: string; photos: string[] } };
  // El POST es público: una lista negra dejaba pasar cualquier host y la ficha
  // acababa con una foto que `next/image` nunca pintaría. Y http:// tampoco,
  // aunque el host sea el correcto.
  expect(business.photos).toEqual([FOTO_VALIDA]);

  // El detalle devuelve `images` (BusinessImage[]), no `photos`: son DTOs
  // distintos. El listado usa `photos: string[]`; la ficha, objetos con id,
  // alt y orden.
  const leido = await request.get(`/api/businesses/${business.id}`);
  expect(leido.status()).toBe(200);
  const cuerpo = (await leido.json()) as { business?: { images?: { url: string }[] } };
  expect((cuerpo.business?.images ?? []).map((i) => i.url)).toEqual([FOTO_VALIDA]);
});

test('la validación rechaza antes de tocar la base', async ({ request }) => {
  const res = await request.post('/api/businesses', {
    data: negocio({ category: 'inventada' })
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toContain('category');
});

/*
 * Sin cubrir: que un fallo de ESCRITURA devuelva 503 en vez de un 201 falso.
 * Es el arreglo de `isDataError` en lib/db.ts, pero provocarlo desde fuera
 * exige que la petición pase la validación de la ruta y aun así la rechace
 * PostgreSQL, y hoy no hay ninguna combinación así: `name` es TEXT sin límite y
 * el INSERT lleva ON CONFLICT (id) DO NOTHING. Se deja anotado en vez de
 * fingir cobertura con una prueba que comprueba otra cosa.
 */
