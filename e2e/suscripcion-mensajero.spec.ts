import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';
import { aislarDeLaRed } from './fixtures/red';

/**
 * Suscripción del mensajero: validez temporal, aviso de vencimiento y
 * renovación. La condición de mensajero caduca, y al vencer deja de poder
 * aceptar carreras sin perder el rol ni el historial.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

test.beforeEach(async ({ page }) => {
  await aislarDeLaRed(page);
});

async function abrirTablon(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Menú principal TransferCuba' })
    .filter({ visible: true })
    .first()
    .click();
  const cajon = page.getByRole('dialog');
  await expect(cajon).toBeVisible();
  // La entrada del cajón se llama "Mis entregas" desde el rediseño; la otra
  // ("Solicitar delivery") también menciona mensajería, de ahí el ancla al inicio.
  await cajon.getByRole('button', { name: /^Mis entregas/ }).click();

  const tablon = page.getByRole('dialog');
  await expect(tablon).toBeVisible();
  return tablon;
}

test.describe('Suscripción vigente', () => {
  test('con margen de sobra no molesta con avisos', async ({ page, crearCuenta }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: 30 });
    const tablon = await abrirTablon(page);

    await expect(tablon.getByRole('tablist')).toBeVisible();
    await expect(tablon.getByText(/Tu suscripción vence el/)).toBeHidden();
  });

  test('avisa y ofrece renovar cuando quedan pocos días', async ({ page, crearCuenta }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: 3 });
    const tablon = await abrirTablon(page);

    // El tablón sigue accesible: avisar no es bloquear.
    await expect(tablon.getByRole('tablist')).toBeVisible();
    await expect(tablon.getByText(/Tu suscripción vence el/)).toBeVisible();
    await expect(tablon.getByText(/quedan 3 días/)).toBeVisible();

    await tablon.getByRole('button', { name: 'Renovar', exact: true }).click();
    // "Renovar suscripción" sale dos veces (título de la vista y cabecera del
    // formulario); el botón de envío es el ancla inequívoca.
    await expect(tablon.getByRole('button', { name: /Renovar por \d+ días/ })).toBeVisible();

    // Se puede volver: renovar antes de tiempo es opcional, no una encerrona.
    await tablon.getByRole('button', { name: 'Volver al tablón' }).click();
    await expect(tablon.getByRole('tablist')).toBeVisible();
  });
});

test.describe('Suscripción vencida', () => {
  test('sustituye el tablón por la pantalla de renovación', async ({ page, crearCuenta }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: -1 });
    const tablon = await abrirTablon(page);

    await expect(tablon.getByText('Tu suscripción venció')).toBeVisible();
    await expect(tablon.getByText(/Conservas tu perfil y tu historial/)).toBeVisible();
    // Sin tablón: las direcciones de recogida no se sirven a quien no paga.
    await expect(tablon.getByRole('tablist')).toBeHidden();
    // Y sin escapatoria hacia el tablón, porque no hay a dónde volver.
    await expect(tablon.getByRole('button', { name: 'Volver al tablón' })).toBeHidden();
  });

  test('el tablón responde 403 al mensajero vencido', async ({ page, crearCuenta }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: -1 });
    await page.goto('/');

    const res = await page.request.get('/api/deliveries/available');
    expect(res.status()).toBe(403);
    const cuerpo = (await res.json()) as { subscriptionExpired?: boolean; error?: string };
    expect(cuerpo.subscriptionExpired).toBe(true);
    expect(cuerpo.error).toContain('venció');
  });

  test('conserva el rol de mensajero: no se degrada la cuenta', async ({ page, crearCuenta }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: -1 });
    await page.goto('/');

    const res = await page.request.get('/api/account/me');
    const cuerpo = (await res.json()) as { user?: { role?: string } };
    expect(cuerpo.user?.role).toBe('MESSENGER');
  });
});

test.describe('Pago de la renovación', () => {
  test('acepta efectivo sin exigir referencia de transferencia', async ({ page, crearCuenta }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: -1 });
    const tablon = await abrirTablon(page);

    // Los radios van `sr-only` y el blanco real es la etiqueta que los envuelve,
    // así que se pulsa la etiqueta; `check()` sobre el input recortado no puede.
    await tablon.getByText('Efectivo', { exact: true }).click();
    await expect(tablon.getByRole('radio', { name: 'Efectivo' })).toBeChecked();
    await expect(tablon.getByText(/Entrega el efectivo al administrador/)).toBeVisible();
    await expect(tablon.getByText('Nota del pago (opcional)')).toBeVisible();

    await tablon.getByRole('button', { name: /Renovar por \d+ días/ }).click();

    await expect(tablon.getByText('Renovación en revisión')).toBeVisible();
    await expect(tablon.getByText(/Entrega \$\d+ CUP en efectivo/)).toBeVisible();
  });

  test('en transferencia exige la referencia', async ({ page, crearCuenta }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: -1 });
    const tablon = await abrirTablon(page);

    await expect(tablon.getByText('Referencia de la transferencia')).toBeVisible();
    await tablon.getByRole('button', { name: /Renovar por \d+ días/ }).click();

    await expect(tablon.getByRole('alert')).toContainText('referencia');
  });

  test('el importe y el periodo salen de la configuración de administración', async ({
    page,
    crearCuenta
  }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: -1 });
    const tablon = await abrirTablon(page);

    // Valores por defecto tras la migración: 300 CUP y 30 días.
    await expect(tablon.getByText('$300 CUP')).toBeVisible();
    await expect(tablon.getByText('30 días', { exact: true })).toBeVisible();
  });
});

test.describe('Responsive a 360 px', () => {
  // Gama baja Android es el escenario real de la app; 360×640 es el suelo.
  test.use({ viewport: { width: 360, height: 640 } });

  test('la pantalla de renovación no desborda ni encoge los controles', async ({
    page,
    crearCuenta
  }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: -1 });
    const tablon = await abrirTablon(page);

    await expect(tablon.getByText('Tu suscripción venció')).toBeVisible();

    // Sin scroll horizontal: nada se sale del ancho de la ventana.
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(desborda, 'la página desborda a lo ancho').toBe(false);

    const anchoVentana = page.viewportSize()!.width;
    const caja = await tablon.boundingBox();
    expect(caja!.width).toBeLessThanOrEqual(anchoVentana);

    // Todo lo pulsable llega a 44 px de alto, incluidos los radios de método.
    const pulsables = tablon.locator('button:visible, label:visible, a:visible');
    const total = await pulsables.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      const el = pulsables.nth(i);
      const b = await el.boundingBox();
      if (!b || b.height === 0) continue;
      expect(b.height, `control ${i} ("${(await el.innerText()).slice(0, 24)}") mide ${b.height}px`)
        .toBeGreaterThanOrEqual(44);
    }
  });

  test('el aviso de vencimiento se apila en vertical, no se comprime', async ({
    page,
    crearCuenta
  }) => {
    await crearCuenta({ rol: 'MESSENGER', diasDeSuscripcion: 2 });
    const tablon = await abrirTablon(page);

    const aviso = tablon.getByText(/Tu suscripción vence el/);
    await expect(aviso).toBeVisible();

    const boton = tablon.getByRole('button', { name: 'Renovar', exact: true });
    const cajaAviso = await aviso.boundingBox();
    const cajaBoton = await boton.boundingBox();
    // En móvil el botón cae DEBAJO del texto (flex-col), no a su lado.
    expect(cajaBoton!.y).toBeGreaterThan(cajaAviso!.y + cajaAviso!.height - 1);
    expect(cajaBoton!.height).toBeGreaterThanOrEqual(44);
  });
});
