import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';

/**
 * Fase 6 — backend de historial y valoraciones.
 *
 * Se ejercita por API y no por UI a propósito: aquí lo que se comprueba son
 * las reglas de propiedad, estado y unicidad, que viven en el servidor y no
 * deben depender de que la pantalla esté montada.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

/** Lleva una carrera de PENDING a DELIVERED con la API real del mensajero. */
async function entregar(
  api: import('@playwright/test').APIRequestContext,
  deliveryId: string
): Promise<void> {
  for (const action of ['accept', 'pick_up', 'in_transit', 'deliver']) {
    const res = await api.patch(`/api/deliveries/${deliveryId}`, { data: { action } });
    expect(res.status(), `${action}: ${await res.text()}`).toBe(200);
  }
}

test.describe('Valoración de una entrega', () => {
  test('el solicitante valora una carrera entregada', async ({ crearCuentaApi, crearCarreraPendiente }) => {
    const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const carrera = await crearCarreraPendiente(solicitante.id);

    await entregar(apiMensajero, carrera.id);

    const res = await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, {
      data: { rating: 5, comment: 'Muy buen trato y entrega rápida' }
    });
    expect(res.status(), await res.text()).toBe(201);

    const { review } = (await res.json()) as { review: { rating: number; comment: string; status: string; deliveryCode: string } };
    expect(review.rating).toBe(5);
    expect(review.comment).toBe('Muy buen trato y entrega rápida');
    expect(review.status).toBe('active');
    expect(review.deliveryCode).toBe(carrera.code);
  });

  test('un segundo intento devuelve 409 y no duplica', async ({ crearCuentaApi, crearCarreraPendiente }) => {
    const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const carrera = await crearCarreraPendiente(solicitante.id);
    await entregar(apiMensajero, carrera.id);

    expect((await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, { data: { rating: 4 } })).status()).toBe(201);

    const segundo = await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, { data: { rating: 1 } });
    expect(segundo.status()).toBe(409);

    const lista = await apiSolicitante.get(`/api/deliveries/${carrera.id}/reviews`);
    const { reviews } = (await lista.json()) as { reviews: unknown[] };
    expect(reviews).toHaveLength(1);
  });

  test('no se puede valorar una carrera que no se pidió', async ({ crearCuentaApi, crearCarreraPendiente }) => {
    const { cuenta: solicitante } = await crearCuentaApi();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const { api: apiIntruso } = await crearCuentaApi();
    const carrera = await crearCarreraPendiente(solicitante.id);
    await entregar(apiMensajero, carrera.id);

    const res = await apiIntruso.post(`/api/deliveries/${carrera.id}/reviews`, { data: { rating: 5 } });
    expect(res.status()).toBe(403);
  });

  test('no se puede valorar una carrera sin entregar', async ({ crearCuentaApi, crearCarreraPendiente }) => {
    const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
    const carrera = await crearCarreraPendiente(solicitante.id);

    const res = await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, { data: { rating: 5 } });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toContain('entregada');
  });

  test('rechaza puntuaciones fuera de 1-5 y comentarios largos', async ({ crearCuentaApi, crearCarreraPendiente }) => {
    const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const carrera = await crearCarreraPendiente(solicitante.id);
    await entregar(apiMensajero, carrera.id);

    for (const rating of [0, 6, 2.5, -1]) {
      const res = await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, { data: { rating } });
      expect(res.status(), `puntuación ${rating}`).toBe(400);
    }

    const largo = await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, {
      data: { rating: 5, comment: 'x'.repeat(501) }
    });
    expect(largo.status()).toBe(400);
  });

  test('una carrera inexistente da 404', async ({ crearCuentaApi }) => {
    const { api } = await crearCuentaApi();
    const res = await api.post('/api/deliveries/00000000-0000-4000-8000-000000000000/reviews', {
      data: { rating: 5 }
    });
    expect(res.status()).toBe(404);
  });
});

test.describe('Agregados del mensajero', () => {
  test('la valoración actualiza rating, conteo y entregas completadas', async ({
    crearCuentaApi,
    crearCarreraPendiente
  }) => {
    const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
    const { cuenta: mensajero, api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });

    // Sin valoraciones: rating null, no 0 ni 5.
    const inicial = await apiMensajero.get(`/api/messengers/${mensajero.id}/stats`);
    const statsInicial = (await inicial.json()).stats as { rating: number | null; reviewCount: number; completedOrders: number };
    expect(statsInicial.rating).toBeNull();
    expect(statsInicial.reviewCount).toBe(0);
    expect(statsInicial.completedOrders).toBe(0);

    const a = await crearCarreraPendiente(solicitante.id);
    await entregar(apiMensajero, a.id);
    await apiSolicitante.post(`/api/deliveries/${a.id}/reviews`, { data: { rating: 5 } });

    const b = await crearCarreraPendiente(solicitante.id);
    await entregar(apiMensajero, b.id);
    await apiSolicitante.post(`/api/deliveries/${b.id}/reviews`, { data: { rating: 4 } });

    const final = await apiMensajero.get(`/api/messengers/${mensajero.id}/stats`);
    const stats = (await final.json()).stats as { rating: number; reviewCount: number; completedOrders: number };
    expect(stats.rating).toBe(4.5);
    expect(stats.reviewCount).toBe(2);
    // Lo incrementa la transición a DELIVERED, que antes no lo tocaba nunca.
    expect(stats.completedOrders).toBe(2);
  });

  test('las estadísticas de otro no son públicas', async ({ crearCuentaApi }) => {
    const { cuenta: mensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const { api: apiTercero } = await crearCuentaApi();

    const res = await apiTercero.get(`/api/messengers/${mensajero.id}/stats`);
    expect(res.status()).toBe(403);
  });
});

test.describe('Historial paginado', () => {
  test('pagina con cursor sin repetir ni saltarse carreras', async ({
    crearCuentaApi,
    crearCarreraPendiente
  }) => {
    const { cuenta: solicitante, api } = await crearCuentaApi();
    for (let i = 0; i < 5; i++) await crearCarreraPendiente(solicitante.id);

    const vistos: string[] = [];
    let cursor: string | null = null;
    for (let pagina = 0; pagina < 5; pagina++) {
      const url: string = `/api/deliveries/history?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const res = await api.get(url);
      expect(res.status(), await res.text()).toBe(200);
      const body = (await res.json()) as { deliveries: { id: string }[]; nextCursor: string | null };
      vistos.push(...body.deliveries.map((d) => d.id));
      cursor = body.nextCursor;
      if (!cursor) break;
    }

    expect(vistos).toHaveLength(5);
    expect(new Set(vistos).size, 'hay carreras repetidas entre páginas').toBe(5);
  });

  test('cada quien ve solo lo suyo', async ({ crearCuentaApi, crearCarreraPendiente }) => {
    const { cuenta: unoCuenta, api: apiUno } = await crearCuentaApi();
    const { api: apiOtro } = await crearCuentaApi();
    await crearCarreraPendiente(unoCuenta.id);

    const propio = (await (await apiUno.get('/api/deliveries/history')).json()) as { deliveries: unknown[] };
    expect(propio.deliveries.length).toBeGreaterThanOrEqual(1);

    const ajeno = (await (await apiOtro.get('/api/deliveries/history')).json()) as { deliveries: unknown[] };
    expect(ajeno.deliveries).toHaveLength(0);
  });

  test('el mensajero ve las asignadas, no las ajenas', async ({ crearCuentaApi, crearCarreraPendiente }) => {
    const { cuenta: solicitante } = await crearCuentaApi();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const { api: apiOtroMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });

    const carrera = await crearCarreraPendiente(solicitante.id);
    await entregar(apiMensajero, carrera.id);

    const suyo = (await (await apiMensajero.get('/api/deliveries/history')).json()) as { deliveries: { id: string }[] };
    expect(suyo.deliveries.map((d) => d.id)).toContain(carrera.id);

    const ajeno = (await (await apiOtroMensajero.get('/api/deliveries/history')).json()) as { deliveries: unknown[] };
    expect(ajeno.deliveries).toHaveLength(0);
  });

  test('valida limit, status y cursor', async ({ crearCuentaApi }) => {
    const { api } = await crearCuentaApi();

    expect((await api.get('/api/deliveries/history?limit=0')).status()).toBe(400);
    expect((await api.get('/api/deliveries/history?limit=51')).status()).toBe(400);
    expect((await api.get('/api/deliveries/history?status=INVENTADO')).status()).toBe(400);
    expect((await api.get('/api/deliveries/history?cursor=no-es-un-cursor')).status()).toBe(400);
  });

  test('filtra por estado', async ({ crearCuentaApi, crearCarreraPendiente }) => {
    const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });

    await crearCarreraPendiente(solicitante.id);
    const entregada = await crearCarreraPendiente(solicitante.id);
    await entregar(apiMensajero, entregada.id);

    const res = await apiSolicitante.get('/api/deliveries/history?status=DELIVERED');
    const { deliveries } = (await res.json()) as { deliveries: { id: string; status: string }[] };
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].id).toBe(entregada.id);
    expect(deliveries[0].status).toBe('DELIVERED');
  });
});

/**
 * Moderación administrativa. Necesita las credenciales del panel, que viven en
 * variables de entorno (`.env.local` en desarrollo, Vercel en producción) y no
 * en el repositorio. Sin `E2E_ADMIN_PASSWORD` el bloque se salta.
 */
const adminUser = process.env.E2E_ADMIN_USER ?? 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('Moderación de valoraciones', () => {
  test.skip(!adminPassword, 'Requiere E2E_ADMIN_PASSWORD');

  test('administración oculta, restaura y elimina lógicamente', async ({
    playwright,
    baseURL,
    crearCuentaApi,
    crearCarreraPendiente
  }) => {
    const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
    const { cuenta: mensajero, api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const carrera = await crearCarreraPendiente(solicitante.id);
    await entregar(apiMensajero, carrera.id);

    const creada = await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, {
      data: { rating: 5, comment: 'Impecable' }
    });
    const { review } = (await creada.json()) as { review: { id: string } };

    const apiAdmin = await playwright.request.newContext({ baseURL });
    const login = await apiAdmin.post('/api/auth/login', {
      data: { username: adminUser, password: adminPassword }
    });
    expect(login.status(), `login admin: ${await login.text()}`).toBe(200);

    const rating = async () => {
      const res = await apiMensajero.get(`/api/messengers/${mensajero.id}/stats`);
      return (await res.json()).stats as { rating: number | null; reviewCount: number };
    };
    expect((await rating()).reviewCount).toBe(1);

    // Ocultar la saca del promedio visible.
    const oculta = await apiAdmin.patch(`/api/admin/deliveries/reviews/${review.id}`, {
      data: { action: 'hide' }
    });
    expect(oculta.status(), await oculta.text()).toBe(200);
    expect((await oculta.json()).review.status).toBe('hidden');
    expect((await rating()).reviewCount).toBe(0);

    // Y el solicitante deja de verla.
    const visibles = await apiSolicitante.get(`/api/deliveries/${carrera.id}/reviews`);
    expect(((await visibles.json()) as { reviews: unknown[] }).reviews).toHaveLength(0);

    const restaurada = await apiAdmin.patch(`/api/admin/deliveries/reviews/${review.id}`, {
      data: { action: 'restore' }
    });
    expect((await restaurada.json()).review.status).toBe('active');
    expect((await rating()).reviewCount).toBe(1);

    // `remove` es lógico: la fila sigue ahí para auditoría.
    const eliminada = await apiAdmin.patch(`/api/admin/deliveries/reviews/${review.id}`, {
      data: { action: 'remove' }
    });
    expect((await eliminada.json()).review.status).toBe('removed');

    await apiAdmin.dispose();
  });

  test('sin sesión de administrador no se modera', async ({ crearCuentaApi }) => {
    const { api } = await crearCuentaApi();
    const res = await api.patch(
      '/api/admin/deliveries/reviews/00000000-0000-4000-8000-000000000000',
      { data: { action: 'hide' } }
    );
    expect(res.status()).toBe(401);
  });
});
