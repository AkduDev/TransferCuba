import { test, expect } from '@playwright/test';

/**
 * Cabeceras de caché de GET /api/businesses.
 *
 * `includeAll=true` devuelve negocios PENDIENTES tras comprobar la sesión de
 * administración. Marcarlo `public` era un agujero real: la CDN cachea por URL
 * y las cookies no forman parte de la clave, así que la respuesta guardada por
 * un administrador se habría servido a cualquiera sin que el control de sesión
 * llegara a ejecutarse.
 */

const adminUser = process.env.E2E_ADMIN_USER ?? 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

test('el listado público es cacheable, con TTL para el navegador', async ({ request }) => {
  // Margen amplio: la primera consulta paga el timeout de conexión a la base
  // antes de que el circuit breaker caiga al fallback (ver docs/operaciones.md).
  const res = await request.get('/api/businesses?province=La+Habana&limit=10', {
    timeout: 60_000
  });
  expect(res.status()).toBe(200);

  const cc = res.headers()['cache-control'] ?? '';
  expect(cc, 'sin max-age el navegador se queda sin TTL').toContain('max-age=60');
  expect(cc).toContain('public');
  expect(cc).toContain('s-maxage=300');
});

test('sin sesión de administración, includeAll no pasa', async ({ request }) => {
  const res = await request.get('/api/businesses?includeAll=true');
  expect(res.status()).toBe(401);
});

test('la respuesta de administración no es cacheable', async ({ playwright, baseURL }) => {
  test.skip(!adminPassword, 'Requiere E2E_ADMIN_PASSWORD');

  const apiAdmin = await playwright.request.newContext({ baseURL });
  const login = await apiAdmin.post('/api/auth/login', {
    data: { username: adminUser, password: adminPassword }
  });
  expect(login.status(), `login admin: ${await login.text()}`).toBe(200);

  const res = await apiAdmin.get('/api/businesses?includeAll=true&limit=10');
  expect(res.status()).toBe(200);

  const cc = res.headers()['cache-control'] ?? '';
  expect(cc, 'datos de administración en una caché compartida').not.toContain('public');
  expect(cc).toContain('no-store');
  await apiAdmin.dispose();
});
