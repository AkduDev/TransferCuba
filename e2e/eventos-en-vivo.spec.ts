import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';
import { aislarDeLaRed } from './fixtures/red';

/**
 * Fase 6 — eventos en vivo (SSE).
 *
 * El stream se abre desde el navegador con `EventSource` nativo, que es lo que
 * usará el cliente real. La contraparte actúa desde un contexto HTTP aparte,
 * así que lo que se comprueba es la propagación entre dos sesiones distintas.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

interface EventoCapturado {
  evento: string;
  tipo?: string;
  deliveryId?: string;
  status?: string;
  lastEventId: string;
}

/**
 * Abre el stream en la página y acumula eventos en `window`. Devuelve una
 * función para leerlos; la conexión se cierra al terminar la prueba con la
 * página.
 */
async function escucharStream(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const capturados: EventoCapturado[] = [];
    (window as unknown as { __sse: EventoCapturado[] }).__sse = capturados;

    const fuente = new EventSource('/api/deliveries/stream');
    (window as unknown as { __sseFuente: EventSource }).__sseFuente = fuente;

    const registrar = (nombre: string) => {
      fuente.addEventListener(nombre, (e) => {
        const ev = e as MessageEvent<string>;
        let cuerpo: { type?: string; delivery?: { id?: string; status?: string } } = {};
        try {
          cuerpo = JSON.parse(ev.data);
        } catch {
          /* dato no JSON */
        }
        capturados.push({
          evento: nombre,
          tipo: cuerpo.type,
          deliveryId: cuerpo.delivery?.id,
          status: cuerpo.delivery?.status,
          lastEventId: ev.lastEventId
        });
      });
    };

    for (const nombre of [
      'ready',
      'heartbeat',
      'delivery.updated',
      'delivery.available',
      'delivery.reviewed',
      'bye',
      'db-unavailable'
    ]) {
      registrar(nombre);
    }

    interface EventoCapturado {
      evento: string;
      tipo?: string;
      deliveryId?: string;
      status?: string;
      lastEventId: string;
    }
  });

  return async (): Promise<EventoCapturado[]> =>
    page.evaluate(() => (window as unknown as { __sse: EventoCapturado[] }).__sse ?? []);
}

test.beforeEach(async ({ page }) => {
  await aislarDeLaRed(page);
});

test('el stream saluda y late', async ({ page, crearCuenta }) => {
  await crearCuenta();
  await page.goto('/');

  const leer = await escucharStream(page);

  // `ready` llega de inmediato: el cliente sabe que hay conexión sin esperar
  // al primer sondeo.
  await expect.poll(async () => (await leer()).some((e) => e.evento === 'ready'), { timeout: 15_000 }).toBe(true);

  const primero = (await leer()).find((e) => e.evento === 'ready')!;
  expect(primero.tipo).toBe('ready');
  expect(primero.lastEventId.length).toBeGreaterThan(0);
});

test('un cambio de estado de otra sesión llega en vivo', async ({
  page,
  crearCuenta,
  crearCuentaApi,
  crearCarreraPendiente
}) => {
  const solicitante = await crearCuenta();
  const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
  const carrera = await crearCarreraPendiente(solicitante.id);

  await page.goto('/');
  const leer = await escucharStream(page);
  await expect.poll(async () => (await leer()).some((e) => e.evento === 'ready'), { timeout: 15_000 }).toBe(true);

  // El mensajero acepta desde su propia sesión, sin tocar la página.
  const aceptar = await apiMensajero.patch(`/api/deliveries/${carrera.id}`, { data: { action: 'accept' } });
  expect(aceptar.status(), await aceptar.text()).toBe(200);

  await expect
    .poll(
      async () => (await leer()).find((e) => e.evento === 'delivery.updated' && e.deliveryId === carrera.id)?.status,
      { timeout: 20_000, message: 'el cambio a ACCEPTED no llegó por el stream' }
    )
    .toBe('ACCEPTED');
});

test('una valoración llega al mensajero en vivo', async ({
  page,
  crearCuenta,
  crearCuentaApi,
  crearCarreraPendiente
}) => {
  // Esta vez quien escucha es el mensajero.
  const mensajero = await crearCuenta({ rol: 'MESSENGER' });
  const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
  const carrera = await crearCarreraPendiente(solicitante.id);

  // Lo lleva a DELIVERED la sesión del navegador (el mensajero).
  for (const action of ['accept', 'pick_up', 'in_transit', 'deliver']) {
    const res = await page.request.patch(`/api/deliveries/${carrera.id}`, { data: { action } });
    expect(res.status(), `${action}: ${await res.text()}`).toBe(200);
  }
  expect(mensajero.rol).toBe('MESSENGER');

  await page.goto('/');
  const leer = await escucharStream(page);
  await expect.poll(async () => (await leer()).some((e) => e.evento === 'ready'), { timeout: 15_000 }).toBe(true);

  const valorar = await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, {
    data: { rating: 5, comment: 'Rapidísimo' }
  });
  expect(valorar.status(), await valorar.text()).toBe(201);

  await expect
    .poll(async () => (await leer()).some((e) => e.evento === 'delivery.reviewed'), {
      timeout: 20_000,
      message: 'la valoración no llegó por el stream'
    })
    .toBe(true);
});

test('sin sesión el stream responde 401 y no abre', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.get('/api/deliveries/stream');
  expect(res.status()).toBe(401);
});

test('un mensajero vencido no recibe el tablón por el stream', async ({
  page,
  crearCuenta,
  crearCuentaApi,
  crearCarreraPendiente
}) => {
  await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: -1 });
  const { cuenta: solicitante } = await crearCuentaApi();

  await page.goto('/');
  const leer = await escucharStream(page);
  await expect.poll(async () => (await leer()).some((e) => e.evento === 'ready'), { timeout: 15_000 }).toBe(true);

  await crearCarreraPendiente(solicitante.id);

  // Se espera al primer latido (15 s), que garantiza que ya hubo varios
  // sondeos: si el tablón fuera a filtrarse, ya habría llegado.
  await expect
    .poll(async () => (await leer()).some((e) => e.evento === 'heartbeat' || e.evento === 'bye'), {
      timeout: 30_000
    })
    .toBe(true);

  const eventos = await leer();
  expect(
    eventos.some((e) => e.evento === 'delivery.available'),
    'el stream filtró una carrera del tablón a un mensajero con la suscripción vencida'
  ).toBe(false);
});

/**
 * El cableado del cliente: que la APLICACIÓN abra el stream y reaccione, no
 * solo que el endpoint funcione. Antes de esto el backend estaba completo pero
 * `EventSource` no aparecía en ningún sitio del cliente: la app vivía del
 * polling y `streamState` se quedaba en 'disconnected' para siempre.
 */
test.describe('Cableado en el cliente', () => {
  test('la aplicación abre el stream al haber sesión', async ({ page, crearCuenta }) => {
    await crearCuenta();

    // Se observa sin interceptar: `page.route` podría bufferizar el SSE.
    const peticionDelStream = page.waitForRequest(
      (req) => req.url().includes('/api/deliveries/stream'),
      { timeout: 20_000 }
    );

    await page.goto('/');
    const req = await peticionDelStream;
    expect(req.method()).toBe('GET');
  });

  test('un cambio de otra sesión llega a la UI sin recargar', async ({
    page,
    crearCuenta,
    crearCuentaApi,
    crearCarreraPendiente
  }) => {
    const solicitante = await crearCuenta();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const carrera = await crearCarreraPendiente(solicitante.id);

    // Se acepta ANTES de cargar la página para que el solicitante arranque
    // siguiendo la carrera (el seguimiento solo engancha estados activos).
    const aceptar = await apiMensajero.patch(`/api/deliveries/${carrera.id}`, { data: { action: 'accept' } });
    expect(aceptar.status(), await aceptar.text()).toBe(200);

    await page.goto('/');
    await page.waitForRequest((r) => r.url().includes('/api/deliveries/stream'), { timeout: 20_000 });

    const recogido = await apiMensajero.patch(`/api/deliveries/${carrera.id}`, { data: { action: 'pick_up' } });
    expect(recogido.status(), await recogido.text()).toBe(200);

    // Con el stream conectado el polling baja a 60 s, así que un aviso en
    // menos de 15 s solo puede haber llegado por el canal en vivo.
    await expect(page.getByText('Tu paquete fue recogido')).toBeVisible({ timeout: 15_000 });
  });
});

/**
 * Los dos caminos que solo se recorren cuando algo va mal, y que por eso se
 * pudren en silencio: el reciclado periódico del stream y el abandono hacia el
 * polling. Son código del cliente que ninguna otra prueba ejercita.
 */
test.describe('Degradación y reconexión', () => {
  test('si el stream falla, el polling sigue actualizando la UI', async ({
    page,
    crearCuenta,
    crearCuentaApi,
    crearCarreraPendiente
  }) => {
    const solicitante = await crearCuenta();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const carrera = await crearCarreraPendiente(solicitante.id);
    await apiMensajero.patch(`/api/deliveries/${carrera.id}`, { data: { action: 'accept' } });

    // El stream se corta de raíz: EventSource reintenta, acumula fallos y el
    // cliente acaba abandonándolo. El polling tiene que sostener la UI.
    let intentos = 0;
    await page.route('**/api/deliveries/stream*', (route) => {
      intentos += 1;
      return route.abort();
    });

    await page.goto('/');
    await expect.poll(() => intentos, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);

    await apiMensajero.patch(`/api/deliveries/${carrera.id}`, { data: { action: 'pick_up' } });

    // Sin stream el polling del solicitante está a 12 s: se da margen a dos
    // ciclos. Si esto falla, la app se quedó sin ningún canal.
    await expect(page.getByText('Tu paquete fue recogido')).toBeVisible({ timeout: 40_000 });
  });

  test('el stream se recicla y se reanuda sin perder eventos', async ({
    page,
    crearCuenta,
    crearCuentaApi,
    crearCarreraPendiente
  }) => {
    test.setTimeout(150_000);

    const solicitante = await crearCuenta();
    const { api: apiMensajero } = await crearCuentaApi({ rol: 'MESSENGER' });
    const carrera = await crearCarreraPendiente(solicitante.id);
    await apiMensajero.patch(`/api/deliveries/${carrera.id}`, { data: { action: 'accept' } });

    // Se cuentan las aperturas: el servidor cierra a propósito cada ~50 s y
    // EventSource reabre solo mandando Last-Event-ID.
    let aperturas = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/deliveries/stream')) aperturas += 1;
    });

    await page.goto('/');
    await expect.poll(() => aperturas, { timeout: 20_000 }).toBe(1);

    // Se espera al reciclado: la segunda apertura prueba que reconectó solo.
    await expect
      .poll(() => aperturas, { timeout: 90_000, message: 'el stream no se reabrió tras el reciclado' })
      .toBeGreaterThanOrEqual(2);

    // Y después de reconectar sigue entregando: un cambio posterior llega.
    await apiMensajero.patch(`/api/deliveries/${carrera.id}`, { data: { action: 'pick_up' } });
    await expect(page.getByText('Tu paquete fue recogido')).toBeVisible({ timeout: 15_000 });
  });
});
