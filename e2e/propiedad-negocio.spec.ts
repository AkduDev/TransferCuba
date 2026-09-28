import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';
import type { APIRequestContext } from '@playwright/test';

/**
 * Propiedad de un negocio (Fase 1 del módulo de dueños).
 *
 * Publicar sigue siendo gratis y anónimo. Ser DUEÑO es otra cosa: se solicita y
 * lo confirma un administrador, porque el alta es pública y no prueba nada.
 *
 * Lo que más importa cubrir aquí es que la propiedad no se pueda tomar sin esa
 * confirmación, ni arrebatar a quien ya la tiene.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

const adminUser = process.env.E2E_ADMIN_USER ?? 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

async function crearNegocio(api: APIRequestContext, nombre: string): Promise<string> {
  const res = await api.post('/api/businesses', {
    data: {
      name: nombre,
      category: 'cafeterias',
      categoryIcon: 'Coffee',
      description: 'Negocio de prueba para la propiedad',
      province: 'La Habana',
      municipality: 'Plaza de la Revolución',
      address: 'Calle 23 #100 e/ L y M',
      whatsapp: '+5355512345',
      phone: '+5355512345',
      hours: '9:00 — 17:00',
      acceptsTransfer: true,
      lat: 23.1385,
      lng: -82.3842
    }
  });
  expect(res.status(), await res.text()).toBe(201);
  const { business } = (await res.json()) as { business: { id: string } };
  return business.id;
}

test('sin sesión no se puede reclamar', async ({ request }) => {
  const id = await crearNegocio(request, `Sin sesión ${Date.now()}`);
  const res = await request.post(`/api/businesses/${id}/claim`, { data: {} });
  expect(res.status()).toBe(401);
});

test('reclamar deja una solicitud pendiente, no convierte en dueño', async ({
  request,
  crearCuentaApi
}) => {
  const id = await crearNegocio(request, `Reclamable ${Date.now()}`);
  const { api } = await crearCuentaApi();

  const res = await api.post(`/api/businesses/${id}/claim`, {
    data: { evidence: 'Soy el dueño, el teléfono del local es el mío' }
  });
  expect(res.status(), await res.text()).toBe(201);
  const { claim } = (await res.json()) as { claim: { status: string; businessId: string } };
  expect(claim.status).toBe('PENDING');
  expect(claim.businessId).toBe(id);

  // Aparece en su cuenta, pero como pendiente: reclamar no da la propiedad.
  const mios = await api.get('/api/account/businesses');
  expect(mios.status()).toBe(200);
  const { businesses } = (await mios.json()) as {
    businesses: { id: string; ownership: string }[];
  };
  expect(businesses.find((b) => b.id === id)?.ownership).toBe('PENDING');
});

test('no se puede reclamar dos veces el mismo negocio', async ({ request, crearCuentaApi }) => {
  const id = await crearNegocio(request, `Dos veces ${Date.now()}`);
  const { api } = await crearCuentaApi();

  expect((await api.post(`/api/businesses/${id}/claim`, { data: {} })).status()).toBe(201);
  const repetida = await api.post(`/api/businesses/${id}/claim`, { data: {} });
  expect(repetida.status()).toBe(409);
});

test('reclamar un negocio inexistente da 404', async ({ crearCuentaApi }) => {
  const { api } = await crearCuentaApi();
  const res = await api.post('/api/businesses/no-existe-este/claim', { data: {} });
  expect(res.status()).toBe(404);
});

test('la evidencia está acotada', async ({ request, crearCuentaApi }) => {
  const id = await crearNegocio(request, `Evidencia ${Date.now()}`);
  const { api } = await crearCuentaApi();
  const res = await api.post(`/api/businesses/${id}/claim`, {
    data: { evidence: 'x'.repeat(501) }
  });
  expect(res.status()).toBe(400);
});

test('registrar con sesión iniciada deja la solicitud hecha', async ({ crearCuentaApi }) => {
  const { api } = await crearCuentaApi();
  const id = await crearNegocio(api, `Con sesión ${Date.now()}`);

  const mios = await api.get('/api/account/businesses');
  const { businesses } = (await mios.json()) as {
    businesses: { id: string; ownership: string }[];
  };
  expect(
    businesses.find((b) => b.id === id)?.ownership,
    'registrar desde la cuenta debe dejar la solicitud creada'
  ).toBe('PENDING');
});

test.describe('Confirmación del administrador', () => {
  test.skip(!adminPassword, 'Requiere E2E_ADMIN_PASSWORD');

  test('confirmar da la propiedad y descarta las demás solicitudes', async ({
    request,
    playwright,
    baseURL,
    crearCuentaApi
  }) => {
    const id = await crearNegocio(request, `Disputado ${Date.now()}`);
    const { cuenta: primera, api: apiPrimera } = await crearCuentaApi();
    const { api: apiSegunda } = await crearCuentaApi();

    await apiPrimera.post(`/api/businesses/${id}/claim`, { data: {} });
    await apiSegunda.post(`/api/businesses/${id}/claim`, { data: {} });

    const apiAdmin = await playwright.request.newContext({ baseURL });
    const login = await apiAdmin.post('/api/auth/login', {
      data: { username: adminUser, password: adminPassword }
    });
    expect(login.status(), `login admin: ${await login.text()}`).toBe(200);

    const cola = await apiAdmin.get('/api/admin/business-claims');
    expect(cola.status()).toBe(200);
    // La cola lleva el teléfono de quien reclama: no puede ser cacheable.
    expect(cola.headers()['cache-control'] ?? '').toContain('no-store');

    const { claims } = (await cola.json()) as {
      claims: { id: string; businessId: string; claimant?: { id: string } }[];
    };
    const deLaPrimera = claims.find(
      (c) => c.businessId === id && c.claimant?.id === primera.id
    );
    expect(deLaPrimera, 'la solicitud no llegó a la cola del administrador').toBeTruthy();

    const confirmada = await apiAdmin.patch(`/api/admin/business-claims/${deLaPrimera!.id}`, {
      data: { action: 'confirm' }
    });
    expect(confirmada.status(), await confirmada.text()).toBe(200);

    // La primera es dueña.
    const suyos = await apiPrimera.get('/api/account/businesses');
    const { businesses } = (await suyos.json()) as {
      businesses: { id: string; ownership: string }[];
    };
    expect(businesses.find((b) => b.id === id)?.ownership).toBe('CONFIRMED');

    // La segunda ya no tiene nada vivo sobre ese negocio.
    const otros = await apiSegunda.get('/api/account/businesses');
    const { businesses: deLaSegunda } = (await otros.json()) as {
      businesses: { id: string }[];
    };
    expect(
      deLaSegunda.some((b) => b.id === id),
      'confirmar a una debe descartar las demás solicitudes'
    ).toBe(false);

    // Y ya no se puede reclamar lo que tiene dueño.
    const tarde = await apiSegunda.post(`/api/businesses/${id}/claim`, { data: {} });
    expect(tarde.status()).toBe(409);

    // Confirmar dos veces la misma solicitud no vale.
    const otraVez = await apiAdmin.patch(`/api/admin/business-claims/${deLaPrimera!.id}`, {
      data: { action: 'confirm' }
    });
    expect(otraVez.status()).toBe(409);

    await apiAdmin.dispose();
  });

  test('el administrador confirma desde el panel, con clics reales', async ({
    page,
    request,
    crearCuentaApi
  }) => {
    // Recorrido largo: cajón, login de administración (que en el dev server
    // compila la ruta en la primera petición), pestaña y confirmación.
    test.slow();

    const nombre = `Panel ${Date.now()}`;
    const id = await crearNegocio(request, nombre);
    const { api } = await crearCuentaApi();
    await api.post(`/api/businesses/${id}/claim`, {
      data: { evidence: 'El teléfono del local es el mío' }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Menú principal TransferCuba' }).first().click();
    // Por el nombre real del botón del cajón: "Panel de Administración" es el
    // chip de la barra superior, otro control distinto.
    await page.getByRole('dialog').getByRole('button', { name: /Administración/ }).click();

    const panel = page.getByRole('dialog');
    await panel.getByPlaceholder('ej. admin').fill(adminUser);
    await panel.getByPlaceholder('••••••••').fill(adminPassword);
    await panel.getByRole('button', { name: /Iniciar Sesión/ }).click();

    // Margen amplio: en el dev server la primera petición a /api/auth/login
    // compila la ruta, y eso se come de sobra el timeout por defecto.
    const pestana = panel.getByRole('button', { name: /Propiedad/ });
    await expect(pestana, 'no se completó el acceso de administración').toBeVisible({
      timeout: 30_000
    });
    // Sin `scrollIntoViewIfNeeded`: el panel se re-renderiza tras el login y ese
    // método trabaja sobre un handle ya resuelto, que queda huérfano. `click`
    // re-resuelve el localizador en cada reintento y además hace scroll solo.
    await pestana.click({ timeout: 30_000 });

    const tarjeta = panel.locator('li').filter({ hasText: nombre });
    await expect(tarjeta, 'la solicitud no aparece en el panel').toBeVisible();
    // El teléfono está a la vista: sin él el administrador no puede comprobar.
    await expect(tarjeta).toContainText('El teléfono del local es el mío');

    await tarjeta.getByRole('button', { name: /Confirmar dueño/ }).click();
    // Espera de red a través del dev server: los 10 s por defecto se quedan
    // cortos cuando la tanda va cargada.
    await expect(tarjeta).toBeHidden({ timeout: 30_000 });

    // Y lo que cuenta: el negocio es suyo de verdad, no solo en pantalla.
    const suyos = await api.get('/api/account/businesses');
    const { businesses } = (await suyos.json()) as { businesses: { id: string; ownership: string }[] };
    expect(businesses.find((b) => b.id === id)?.ownership).toBe('CONFIRMED');
  });

  test('sin sesión de administrador la cola no se ve', async ({ request }) => {
    expect((await request.get('/api/admin/business-claims')).status()).toBe(401);
    const patch = await request.patch(
      '/api/admin/business-claims/00000000-0000-0000-0000-000000000000',
      { data: { action: 'confirm' } }
    );
    expect(patch.status()).toBe(401);
  });
});
