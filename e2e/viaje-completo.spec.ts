import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';

/**
 * Fase 6 — los dos criterios que faltaban por cubrir: que el mapa se actualice
 * sin recargar, y el recorrido entero pulsando la interfaz.
 *
 * La creación de la carrera se siembra por SQL. Crearla desde la UI llamaría a
 * OSRM **desde el servidor**, así que no se puede interceptar desde el
 * navegador: la prueba dependería de un servicio externo sin SLA y fallaría por
 * causas ajenas al código. Todo lo demás —aceptar, los pasos, entregar,
 * valorar, historial— va pulsando de verdad.
 *
 * Aquí NO se aísla la red: el mapa necesita su estilo y sus glifos.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

type Pagina = import('@playwright/test').Page;

/** Número de features en un source GeoJSON del mapa, o -1 si no existe. */
function featuresDelSource(page: Pagina, sourceId: string): Promise<number> {
  return page.evaluate((id) => {
    // Se tipa al mínimo que se usa: importar el tipo de maplibre-gl aquí
    // arrastraría la librería entera al bundle de la prueba.
    const mapa = (window as unknown as { __MAP__?: { getSource: (id: string) => unknown } }).__MAP__;
    if (!mapa) return -1;
    const source = mapa.getSource(id) as unknown as
      | { serialize?: () => { data?: { features?: unknown[] } }; _data?: { features?: unknown[] } }
      | undefined;
    if (!source) return -1;
    const data = source.serialize?.().data ?? source._data;
    return Array.isArray(data?.features) ? data.features.length : -1;
  }, sourceId);
}

async function esperarMapa(page: Pagina) {
  await page.waitForFunction(() => Boolean((window as unknown as { __MAP__?: unknown }).__MAP__), {
    timeout: 45_000
  });
}

async function abrirTablon(page: Pagina) {
  await page.getByRole('button', { name: 'Menú principal TransferCuba' }).filter({ visible: true }).first().click();
  const cajon = page.getByRole('dialog');
  await expect(cajon).toBeVisible();
  await cajon.getByRole('button', { name: /^Mis entregas/ }).click();
  const tablon = page.getByRole('dialog');
  await expect(tablon).toBeVisible();
  return tablon;
}

test('el mapa pinta una solicitud nueva sin recargar la página', async ({
  page,
  crearCuenta,
  crearCuentaApi,
  crearCarreraPendiente
}) => {
  test.setTimeout(120_000);

  await crearCuenta({ rol: 'MESSENGER' });
  const { cuenta: solicitante } = await crearCuentaApi();

  await page.goto('/');
  await esperarMapa(page);

  // Punto de partida: el tablón del mapa está vacío.
  await expect
    .poll(() => featuresDelSource(page, 'deliveries-requests-source'), { timeout: 30_000 })
    .toBe(0);

  // La solicitud nace en otra sesión. El aviso llega por el stream, el hook
  // refresca el tablón y `page.tsx` baja la lista al mapa.
  await crearCarreraPendiente(solicitante.id);

  await expect
    .poll(() => featuresDelSource(page, 'deliveries-requests-source'), {
      timeout: 45_000,
      message: 'el mapa no reflejó la solicitud nueva sin recargar'
    })
    .toBe(1);
});

test('recorrido completo por la interfaz: aceptar, entregar, valorar e historial', async ({
  page,
  browser,
  crearCuenta,
  crearCuentaApi,
  crearCarreraPendiente
}) => {
  test.setTimeout(180_000);

  // El mensajero vive en la pestaña principal; el solicitante, en un contexto
  // aparte, porque las dos sesiones tienen que estar vivas a la vez.
  await crearCuenta({ rol: 'MESSENGER' });
  const { cuenta: solicitante, api: apiSolicitante } = await crearCuentaApi();
  const carrera = await crearCarreraPendiente(solicitante.id);

  /* --- 1. El mensajero acepta desde el tablón --- */
  await page.goto('/');
  const tablon = await abrirTablon(page);

  // El código sale más de una vez en el panel (tarjeta y cabecera), así que se
  // ancla a la primera en vez de exigir unicidad.
  const tarjeta = tablon.getByText(carrera.code).first();
  await expect(tarjeta).toBeVisible({ timeout: 30_000 });
  await tablon.getByRole('button', { name: new RegExp(`Aceptar.*${carrera.code}`) }).click();

  /* --- 2. Los tres pasos hasta entregar --- */
  for (const paso of [
    'Confirmar recogida del paquete',
    'Iniciar viaje al destino',
    'Marcar como entregado'
  ]) {
    const boton = tablon.getByRole('button', { name: paso });
    await expect(boton).toBeVisible({ timeout: 20_000 });
    await boton.click();
  }
  await expect(tablon.getByText(/Entrega completada|Carrera completada/)).toBeVisible({ timeout: 20_000 });

  /* --- 3. El solicitante valora desde su historial --- */
  const contexto = await browser.newContext();
  const paginaSolicitante = await contexto.newPage();
  // Se traslada la sesión del solicitante al navegador.
  const cookies = await apiSolicitante.storageState();
  await contexto.addCookies(cookies.cookies);

  await paginaSolicitante.goto('/');
  await paginaSolicitante
    .getByRole('button', { name: 'Menú principal TransferCuba' })
    .filter({ visible: true })
    .first()
    .click();
  const cajon = paginaSolicitante.getByRole('dialog');
  await cajon.getByRole('button', { name: /^Solicitar delivery/ }).click();

  const modalEnvios = paginaSolicitante.getByRole('dialog');
  await expect(modalEnvios).toBeVisible();
  await modalEnvios.getByRole('button', { name: /Ver mis envíos/ }).click();

  // El historial trae la carrera entregada, con su código.
  await expect(modalEnvios.getByText(carrera.code).first()).toBeVisible({ timeout: 20_000 });

  await modalEnvios.getByRole('button', { name: 'Valorar mensajero' }).click();
  await modalEnvios.getByRole('button', { name: '5 estrellas' }).click();
  await modalEnvios.getByPlaceholder('Comentario opcional...').fill('Todo perfecto');
  await modalEnvios.getByRole('button', { name: 'Enviar' }).click();

  /* --- 4. La valoración queda registrada y no se puede repetir --- */
  // Anclas que NO pueden pasar en vacío. "5/5" no sirve: el propio formulario
  // lo pinta mientras eliges estrellas. Y el botón "Valorar mensajero"
  // desaparece solo con abrir el formulario, haya guardado o no.
  // El formulario se cierra únicamente si el servidor respondió que sí
  // (`handleSubmit` solo limpia el estado cuando `ok`), así que su desaparición
  // es la señal fiable.
  await expect(modalEnvios.getByPlaceholder('Comentario opcional...')).toBeHidden({
    timeout: 20_000
  });
  // Y el comentario solo se pinta como TEXTO cuando la valoración ya está
  // persistida; mientras se edita vive dentro del textarea.
  await expect(modalEnvios.getByText('Todo perfecto')).toBeVisible({ timeout: 10_000 });

  // Confirmación en el servidor, que es la autoridad.
  const listado = await apiSolicitante.get(`/api/deliveries/${carrera.id}/reviews`);
  const { reviews } = (await listado.json()) as { reviews: { rating: number; comment: string }[] };
  expect(reviews, 'la valoración no llegó a persistirse').toHaveLength(1);
  expect(reviews[0].rating).toBe(5);
  expect(reviews[0].comment).toBe('Todo perfecto');

  const repetida = await apiSolicitante.post(`/api/deliveries/${carrera.id}/reviews`, {
    data: { rating: 1 }
  });
  expect(repetida.status(), 'la valoración se pudo repetir').toBe(409);

  await contexto.close();
});
