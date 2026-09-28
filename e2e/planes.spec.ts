import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';
import type { APIRequestContext } from '@playwright/test';

/**
 * Motor de planes de pago.
 *
 * Lo que más importa cubrir: que pedir un plan NO lo active —lo confirma un
 * administrador— y que **el importe se congela al pedirlo**. Si el precio
 * subiera y eso reescribiera lo ya solicitado, alguien pagaría lo que no
 * aceptó.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

const adminUser = process.env.E2E_ADMIN_USER ?? 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

/** Tipado estructural: el fixture `playwright` no es el módulo importado. */
type FabricaDeContextos = {
  request: { newContext: (opciones?: { baseURL?: string }) => Promise<APIRequestContext> };
};

async function sesionAdmin(playwright: FabricaDeContextos, baseURL?: string) {
  const api = await playwright.request.newContext({ baseURL });
  const login = await api.post('/api/auth/login', {
    data: { username: adminUser, password: adminPassword }
  });
  expect(login.status(), `login admin: ${await login.text()}`).toBe(200);
  return api;
}

async function precioDe(api: APIRequestContext, code: string): Promise<number> {
  const res = await api.get('/api/plans');
  const { plans } = (await res.json()) as { plans: { code: string; priceCup: number }[] };
  return plans.find((p) => p.code === code)!.priceCup;
}

test('el catálogo público lista los planes con su precio', async ({ request }) => {
  const res = await request.get('/api/plans');
  expect(res.status()).toBe(200);
  const { plans } = (await res.json()) as {
    plans: { code: string; scope: string; priceCup: number; features: string[] }[];
  };

  const cuenta = plans.find((p) => p.code === 'owner_account');
  const negocio = plans.find((p) => p.code === 'business_promo');
  expect(cuenta, 'falta el plan de cuenta').toBeTruthy();
  expect(negocio, 'falta el plan de un negocio').toBeTruthy();

  // La regla del producto: la cuenta cuesta más y da más.
  expect(cuenta!.priceCup).toBeGreaterThan(negocio!.priceCup);
  expect(cuenta!.features).toEqual(expect.arrayContaining(['featured', 'stats', 'photos']));
  expect(negocio!.features).toEqual(['featured']);
});

test('sin sesión no se puede pedir un plan', async ({ request }) => {
  const res = await request.post('/api/plans/owner_account/subscribe', {
    data: { method: 'efectivo' }
  });
  expect(res.status()).toBe(401);
});

test('pedir un plan deja un pago pendiente, no lo activa', async ({ request, crearCuentaApi }) => {
  const { api } = await crearCuentaApi();
  const precio = await precioDe(request, 'owner_account');

  const res = await api.post('/api/plans/owner_account/subscribe', {
    data: { method: 'efectivo' }
  });
  expect(res.status(), await res.text()).toBe(201);
  const { payment } = (await res.json()) as {
    payment: { amountCup: number; status: string; kind: string };
  };
  expect(payment.status).toBe('PENDING');
  expect(payment.kind).toBe('alta');
  expect(payment.amountCup).toBe(precio);

  const mias = await api.get('/api/account/subscriptions');
  const { subscriptions } = (await mias.json()) as {
    subscriptions: { planCode: string; status: string; expiresAt: string | null }[];
  };
  const suscripcion = subscriptions.find((s) => s.planCode === 'owner_account');
  expect(suscripcion?.status, 'pedir no puede activar').toBe('PENDING');
  expect(suscripcion?.expiresAt).toBeNull();
});

test('no se puede pedir dos veces el mismo plan', async ({ crearCuentaApi }) => {
  const { api } = await crearCuentaApi();
  expect(
    (await api.post('/api/plans/owner_account/subscribe', { data: { method: 'efectivo' } })).status()
  ).toBe(201);
  const repetida = await api.post('/api/plans/owner_account/subscribe', {
    data: { method: 'efectivo' }
  });
  expect(repetida.status()).toBe(409);
});

test('en transferencia la referencia es obligatoria', async ({ crearCuentaApi }) => {
  const { api } = await crearCuentaApi();
  const sinReferencia = await api.post('/api/plans/owner_account/subscribe', {
    data: { method: 'transferencia' }
  });
  expect(sinReferencia.status()).toBe(400);
  expect((await sinReferencia.json()).error).toMatch(/referencia/i);

  const conReferencia = await api.post('/api/plans/owner_account/subscribe', {
    data: { method: 'transferencia', reference: 'TM-90210' }
  });
  expect(conReferencia.status()).toBe(201);
});

test('promocionar un negocio exige elegirlo, y que sea tuyo', async ({
  request,
  crearCuentaApi
}) => {
  const { api } = await crearCuentaApi();

  const sinNegocio = await api.post('/api/plans/business_promo/subscribe', {
    data: { method: 'efectivo' }
  });
  expect(sinNegocio.status(), 'un plan de negocio sin negocio no tiene sentido').toBe(400);

  // Un negocio que no es suyo: existe, pero no le pertenece.
  const creado = await request.post('/api/businesses', {
    data: {
      name: `Ajeno ${Date.now()}`,
      category: 'cafeterias',
      categoryIcon: 'Coffee',
      description: 'Negocio de otra persona',
      province: 'La Habana',
      municipality: 'Plaza de la Revolución',
      address: 'Calle 23 #100',
      whatsapp: '+5355512345',
      phone: '+5355512345',
      hours: '9:00 — 17:00',
      acceptsTransfer: true,
      lat: 23.1385,
      lng: -82.3842
    }
  });
  const { business } = (await creado.json()) as { business: { id: string } };

  const ajeno = await api.post('/api/plans/business_promo/subscribe', {
    data: { method: 'efectivo', businessId: business.id }
  });
  expect(ajeno.status(), 'no se puede promocionar lo que no es tuyo').toBe(403);
});

test('la cuenta premium no admite un negocio concreto', async ({ crearCuentaApi }) => {
  const { api } = await crearCuentaApi();
  const res = await api.post('/api/plans/owner_account/subscribe', {
    data: { method: 'efectivo', businessId: 'biz-1' }
  });
  expect(res.status()).toBe(400);
});

test.describe('Administración de los planes', () => {
  test.skip(!adminPassword, 'Requiere E2E_ADMIN_PASSWORD');

  test('el precio se cambia desde la API y no reescribe lo ya pedido', async ({
    request,
    playwright,
    baseURL,
    crearCuentaApi
  }) => {
    const apiAdmin = await sesionAdmin(playwright, baseURL);
    const original = await precioDe(request, 'owner_account');

    // Alguien pide al precio de hoy.
    const { api } = await crearCuentaApi();
    const pedido = await api.post('/api/plans/owner_account/subscribe', {
      data: { method: 'efectivo' }
    });
    const { payment } = (await pedido.json()) as { payment: { id: string; amountCup: number } };
    expect(payment.amountCup).toBe(original);

    // El administrador sube el precio.
    const nuevo = original + 123;
    const cambio = await apiAdmin.patch('/api/admin/plans/owner_account', {
      data: { priceCup: nuevo }
    });
    expect(cambio.status(), await cambio.text()).toBe(200);
    expect(await precioDe(request, 'owner_account')).toBe(nuevo);

    // Lo ya pedido conserva su importe: se congeló al solicitarlo.
    const cola = await apiAdmin.get('/api/admin/plan-payments');
    const { payments } = (await cola.json()) as {
      payments: { id: string; amountCup: number }[];
    };
    const suyo = payments.find((p) => p.id === payment.id);
    expect(suyo?.amountCup, 'subir el precio no puede reescribir un pago pedido').toBe(original);

    // Se deja como estaba, que otras pruebas leen este precio.
    await apiAdmin.patch('/api/admin/plans/owner_account', { data: { priceCup: original } });
    await apiAdmin.dispose();
  });

  test('confirmar el pago activa la suscripción con su vigencia', async ({
    playwright,
    baseURL,
    crearCuentaApi
  }) => {
    const apiAdmin = await sesionAdmin(playwright, baseURL);
    const { api } = await crearCuentaApi();

    const pedido = await api.post('/api/plans/owner_account/subscribe', {
      data: { method: 'transferencia', reference: 'TM-12345' }
    });
    const { payment } = (await pedido.json()) as { payment: { id: string; periodDays: number } };

    const confirmado = await apiAdmin.patch(`/api/admin/plan-payments/${payment.id}`, {
      data: { action: 'confirm' }
    });
    expect(confirmado.status(), await confirmado.text()).toBe(200);

    const mias = await api.get('/api/account/subscriptions');
    const { subscriptions } = (await mias.json()) as {
      subscriptions: { planCode: string; status: string; daysLeft: number | null }[];
    };
    const suscripcion = subscriptions.find((s) => s.planCode === 'owner_account');
    expect(suscripcion?.status).toBe('ACTIVE');
    expect(suscripcion?.daysLeft).toBeGreaterThan(payment.periodDays - 2);

    // Confirmar dos veces el mismo pago no vale.
    const otraVez = await apiAdmin.patch(`/api/admin/plan-payments/${payment.id}`, {
      data: { action: 'confirm' }
    });
    expect(otraVez.status()).toBe(409);
    await apiAdmin.dispose();
  });

  test('sin sesión de administrador no se tocan precios ni cobros', async ({ request }) => {
    expect((await request.get('/api/admin/plans')).status()).toBe(401);
    expect((await request.get('/api/admin/plan-payments')).status()).toBe(401);
    expect(
      (await request.patch('/api/admin/plans/owner_account', { data: { priceCup: 1 } })).status()
    ).toBe(401);
  });
});
