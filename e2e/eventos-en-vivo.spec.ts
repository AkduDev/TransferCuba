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
