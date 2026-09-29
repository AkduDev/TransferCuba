import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';
import type { APIRequestContext } from '@playwright/test';

/**
 * Lo que los planes desbloquean de verdad (Fase 3).
 *
 * Lo que más importa cubrir es que una función premium NO se encienda sin un
 * pago confirmado, y que el límite de fotos dependa de lo que el negocio tiene
 * desbloqueado y no de quién lo pide.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

// Este recorrido toca muchas rutas por primera vez y el dev server las compila
// al vuelo; los 15 s por defecto se los come la compilación, no el producto.
test.use({ actionTimeout: 60_000 });

const adminUser = process.env.E2E_ADMIN_USER ?? 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

type FabricaDeContextos = {
  request: {
    newContext: (o?: { baseURL?: string; timeout?: number }) => Promise<APIRequestContext>;
  };
};

const FOTO = (n: number) =>
  `https://res.cloudinary.com/demo/image/upload/v1/businesses/f${n}-${Date.now()}.jpg`;

/** Crea un negocio publicado y devuelve su id. */
async function negocioPublicado(
  anonimo: APIRequestContext,
  apiAdmin: APIRequestContext,
  nombre: string
): Promise<string> {
  const creado = await anonimo.post('/api/businesses', {
    data: {
      name: nombre,
      category: 'cafeterias',
      categoryIcon: 'Coffee',
      description: 'Negocio de prueba para las funciones premium',
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
  expect(creado.status(), await creado.text()).toBe(201);
  const { business } = (await creado.json()) as { business: { id: string } };
  const aprobado = await apiAdmin.patch('/api/businesses', {
    data: { id: business.id, action: 'approve' }
  });
  expect(aprobado.status()).toBe(200);
  return business.id;
}

/** Deja el negocio en manos de esa cuenta, con la propiedad ya confirmada. */
async function hacerDueno(
  api: APIRequestContext,
  apiAdmin: APIRequestContext,
  businessId: string,
  userId: string
): Promise<void> {
  const reclamo = await api.post(`/api/businesses/${businessId}/claim`, { data: {} });
  expect(reclamo.status(), await reclamo.text()).toBe(201);
  const cola = await apiAdmin.get('/api/admin/business-claims');
  const { claims } = (await cola.json()) as {
    claims: { id: string; businessId: string; claimant?: { id: string } }[];
  };
  const suya = claims.find((c) => c.businessId === businessId && c.claimant?.id === userId);
  expect(suya, 'la solicitud de propiedad no llegó a la cola').toBeTruthy();
  const confirmada = await apiAdmin.patch(`/api/admin/business-claims/${suya!.id}`, {
    data: { action: 'confirm' }
  });
  expect(confirmada.status(), await confirmada.text()).toBe(200);
}

async function sesionAdmin(playwright: FabricaDeContextos, baseURL?: string) {
  const api = await playwright.request.newContext({ baseURL, timeout: 60_000 });
  const login = await api.post('/api/auth/login', {
    data: { username: adminUser, password: adminPassword }
  });
  expect(login.status(), `login admin: ${await login.text()}`).toBe(200);
  return api;
}

async function estaDestacado(api: APIRequestContext, businessId: string): Promise<boolean> {
  const res = await api.get(`/api/businesses/${businessId}`);
  expect(res.status()).toBe(200);
  const cuerpo = (await res.json()) as { business?: { featured?: boolean } };
  return cuerpo.business?.featured === true;
}

test.describe('Funciones que desbloquean los planes', () => {
  test.skip(!adminPassword, 'Requiere E2E_ADMIN_PASSWORD');

  test('destacar solo se enciende con el pago confirmado', async ({
    playwright,
    baseURL,
    crearCuentaApi
  }) => {
    test.slow();
    const anonimo = await playwright.request.newContext({ baseURL, timeout: 60_000 });
    const apiAdmin = await sesionAdmin(playwright, baseURL);
    const { cuenta, api } = await crearCuentaApi();

    const id = await negocioPublicado(anonimo, apiAdmin, `Destacado ${Date.now()}`);
    await hacerDueno(api, apiAdmin, id, cuenta.id);

    expect(await estaDestacado(anonimo, id), 'un negocio sin plan no puede salir destacado').toBe(
      false
    );

    // Pide el plan: pedir no activa nada.
    const pedido = await api.post('/api/plans/business_promo/subscribe', {
      data: { method: 'efectivo', businessId: id }
    });
    expect(pedido.status(), await pedido.text()).toBe(201);
    const { payment } = (await pedido.json()) as { payment: { id: string } };

    expect(
      await estaDestacado(anonimo, id),
      'pedir sin pagar no puede destacar: sería regalar lo que se vende'
    ).toBe(false);

    // El administrador confirma el pago.
    const confirmado = await apiAdmin.patch(`/api/admin/plan-payments/${payment.id}`, {
      data: { action: 'confirm' }
    });
    expect(confirmado.status(), await confirmado.text()).toBe(200);

    expect(await estaDestacado(anonimo, id), 'con el pago confirmado debe destacarse').toBe(true);

    await anonimo.dispose();
    await apiAdmin.dispose();
  });

  test('la cuenta premium destaca todos los negocios del dueño', async ({
    playwright,
    baseURL,
    crearCuentaApi
  }) => {
    test.slow();
    const anonimo = await playwright.request.newContext({ baseURL, timeout: 60_000 });
    const apiAdmin = await sesionAdmin(playwright, baseURL);
    const { cuenta, api } = await crearCuentaApi();

    const marca = Date.now();
    const uno = await negocioPublicado(anonimo, apiAdmin, `Cuenta A ${marca}`);
    const dos = await negocioPublicado(anonimo, apiAdmin, `Cuenta B ${marca}`);
    await hacerDueno(api, apiAdmin, uno, cuenta.id);
    await hacerDueno(api, apiAdmin, dos, cuenta.id);

    const pedido = await api.post('/api/plans/owner_account/subscribe', {
      data: { method: 'efectivo' }
    });
    const { payment } = (await pedido.json()) as { payment: { id: string } };
    await apiAdmin.patch(`/api/admin/plan-payments/${payment.id}`, { data: { action: 'confirm' } });

    expect(await estaDestacado(anonimo, uno)).toBe(true);
    expect(await estaDestacado(anonimo, dos), 'la cuenta cubre TODOS sus negocios').toBe(true);

    await anonimo.dispose();
    await apiAdmin.dispose();
  });

  test('las estadísticas solo se abren con el plan que las incluye', async ({
    playwright,
    baseURL,
    crearCuentaApi
  }) => {
    test.slow();
    const anonimo = await playwright.request.newContext({ baseURL, timeout: 60_000 });
    const apiAdmin = await sesionAdmin(playwright, baseURL);
    const { cuenta, api } = await crearCuentaApi();
    const { api: apiAjena } = await crearCuentaApi();

    const id = await negocioPublicado(anonimo, apiAdmin, `Visitas ${Date.now()}`);
    await hacerDueno(api, apiAdmin, id, cuenta.id);

    // Contar una apertura es público: quien mira no tiene por qué tener cuenta.
    const contada = await anonimo.post(`/api/businesses/${id}/view`);
    expect(contada.status()).toBe(200);
    expect((await contada.json()).counted, 'un negocio publicado debe contar').toBe(true);

    // Sin el plan, el dueño no ve nada: 402, que es "te falta pagar", no 403.
    const bloqueada = await api.get(`/api/businesses/${id}/stats`);
    expect(bloqueada.status(), 'sin plan las estadísticas no se abren').toBe(402);

    // Y el de al lado tampoco, ni con plan ni sin él.
    expect((await apiAjena.get(`/api/businesses/${id}/stats`)).status()).toBe(403);

    const pedido = await api.post('/api/plans/owner_account/subscribe', {
      data: { method: 'efectivo' }
    });
    const { payment } = (await pedido.json()) as { payment: { id: string } };
    await apiAdmin.patch(`/api/admin/plan-payments/${payment.id}`, { data: { action: 'confirm' } });

    const abierta = await api.get(`/api/businesses/${id}/stats`);
    expect(abierta.status(), await abierta.text()).toBe(200);
    const { total, series } = (await abierta.json()) as {
      total: number;
      series: { day: string; views: number }[];
    };
    expect(total, 'la apertura contada debe aparecer').toBeGreaterThanOrEqual(1);
    // La serie no puede tener huecos: una curva con días ausentes miente.
    expect(series).toHaveLength(30);

    await anonimo.dispose();
    await apiAdmin.dispose();
  });

  test('el tope de fotos sube con el plan, y solo el dueño las cuelga', async ({
    playwright,
    baseURL,
    crearCuentaApi
  }) => {
    test.slow();
    const anonimo = await playwright.request.newContext({ baseURL, timeout: 60_000 });
    const apiAdmin = await sesionAdmin(playwright, baseURL);
    const { cuenta, api } = await crearCuentaApi();
    const { api: apiAjena } = await crearCuentaApi();

    const id = await negocioPublicado(anonimo, apiAdmin, `Fotos ${Date.now()}`);
    await hacerDueno(api, apiAdmin, id, cuenta.id);

    const subir = (contexto: APIRequestContext, n: number) =>
      contexto.post(`/api/businesses/${id}/images`, {
        data: { url: FOTO(n), publicId: `businesses/f${n}`, alt: `foto ${n}` }
      });

    // Quien no es dueño no cuelga nada, aunque tenga cuenta.
    expect((await subir(apiAjena, 99)).status(), 'no es su negocio').toBe(403);

    // Plan gratis: tres y se acabó.
    for (let i = 1; i <= 3; i++) {
      expect((await subir(api, i)).status(), `foto ${i} del plan gratis`).toBe(200);
    }
    const cuarta = await subir(api, 4);
    expect(cuarta.status(), 'la cuarta debe chocar con el tope gratis').toBe(409);
    expect((await cuarta.json()).error).toMatch(/límite de 3/);

    // Con la cuenta premium confirmada, el tope sube.
    const pedido = await api.post('/api/plans/owner_account/subscribe', {
      data: { method: 'efectivo' }
    });
    const { payment } = (await pedido.json()) as { payment: { id: string } };
    await apiAdmin.patch(`/api/admin/plan-payments/${payment.id}`, { data: { action: 'confirm' } });

    expect((await subir(api, 4)).status(), 'con plan premium la cuarta debe entrar').toBe(200);

    await anonimo.dispose();
    await apiAdmin.dispose();
  });
});
