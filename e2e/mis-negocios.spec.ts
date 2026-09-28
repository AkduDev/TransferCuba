import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';

/**
 * El recorrido del dueño, con clics reales.
 *
 * Solo se pueden reclamar negocios YA PUBLICADOS: la búsqueda del modal usa
 * `/api/businesses?q=`, que devuelve únicamente los `active`. Por eso la prueba
 * aprueba el negocio antes — si no, no habría nada que encontrar, y ese sería
 * un fallo de la prueba y no del producto.
 */

test.skip(
  !hayBaseDePruebas,
  'Requiere E2E_DATABASE_URL (base aparte, con las migraciones de db/ aplicadas)'
);

const adminUser = process.env.E2E_ADMIN_USER ?? 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

test('un dueño reclama su negocio desde la interfaz', async ({
  page,
  playwright,
  baseURL,
  crearCuenta
}) => {
  test.skip(!adminPassword, 'Requiere E2E_ADMIN_PASSWORD para publicar el negocio');
  test.slow();

  const marca = `Cafetería Dueña ${Date.now()}`;

  // 1. Un negocio publicado al que aspirar.
  const anonimo = await playwright.request.newContext({ baseURL });
  const creado = await anonimo.post('/api/businesses', {
    data: {
      name: marca,
      category: 'cafeterias',
      categoryIcon: 'Coffee',
      description: 'Negocio de prueba del recorrido del dueño',
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

  const apiAdmin = await playwright.request.newContext({ baseURL });
  const login = await apiAdmin.post('/api/auth/login', {
    data: { username: adminUser, password: adminPassword }
  });
  expect(login.status(), `login admin: ${await login.text()}`).toBe(200);
  const aprobado = await apiAdmin.patch('/api/businesses', {
    data: { id: business.id, action: 'approve' }
  });
  expect(aprobado.status(), await aprobado.text()).toBe(200);

  // 2. Una persona con sesión abre "Mis negocios" desde el cajón.
  await crearCuenta();
  await page.goto('/');
  await page.getByRole('button', { name: 'Menú principal TransferCuba' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Mis negocios/ }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toHaveAccessibleName(/Mis negocios/);
  // Margen: la primera petición a /api/account/businesses compila la ruta en el
  // dev server, y eso se come los 10 s por defecto.
  try {
    await expect(modal.getByText('Todavía no tienes ninguno')).toBeVisible({ timeout: 30_000 });
  } catch (e) {
    const texto = (await modal.innerText()).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`La lista no llegó a cargar. En pantalla: "${texto}"`);
  }

  // 3. Lo busca y lo reclama.
  const respuestas: string[] = [];
  page.on('response', async (r) => {
    if (!r.url().includes('/api/businesses?q=')) return;
    respuestas.push(`${r.status()} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  });

  await modal.getByRole('searchbox').fill(marca);
  await modal.getByRole('button', { name: 'Buscar' }).click();
  const candidato = modal.getByRole('button', { name: new RegExp(marca) });
  try {
    await expect(candidato).toBeVisible({ timeout: 20_000 });
  } catch (e) {
    throw new Error(
      `El negocio publicado no aparece en la búsqueda. Respuestas: ${JSON.stringify(respuestas)}. ` +
        `Original: ${(e as Error).message.split('\n')[0]}`
    );
  }
  await candidato.click();

  await modal.getByRole('textbox').fill('El teléfono del local es el mío');
  await modal.getByRole('button', { name: /Enviar solicitud/ }).click();

  // 4. Queda en revisión, no entregado: reclamar no da la propiedad.
  try {
    await expect(modal.getByText(/Solicitud enviada/)).toBeVisible({ timeout: 20_000 });
  } catch (e) {
    // El modal pinta el motivo en un role=alert; sin recogerlo el fallo solo
    // dice "no apareció el mensaje" y hay que adivinar.
    const enPantalla = await modal.getByRole('alert').allInnerTexts().catch(() => []);
    throw new Error(
      `No se confirmó el envío. En pantalla: ${JSON.stringify(enPantalla)}. ` +
        `Original: ${(e as Error).message.split('\n')[0]}`
    );
  }
  const ficha = modal.locator('li').filter({ hasText: marca });
  await expect(ficha).toBeVisible();
  await expect(ficha, 'reclamar no puede aparecer como propiedad concedida').toContainText(
    'En revisión'
  );

  await anonimo.dispose();
  await apiAdmin.dispose();
});

test('sin sesión, el modal invita a entrar en vez de fallar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menú principal TransferCuba' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Mis negocios/ }).click();

  const modal = page.getByRole('dialog');
  await expect(modal.getByText(/Inicia sesión para gestionar tus negocios/)).toBeVisible();
  await expect(modal.getByRole('button', { name: /Iniciar sesión o registrarse/ })).toBeVisible();
});

test('el modal no desborda a 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menú principal TransferCuba' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Mis negocios/ }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(desborda, 'el modal de dueño desborda a lo ancho en móvil').toBe(false);
});

test('un dueño pide un plan desde su panel', async ({ page, playwright, baseURL, crearCuenta }) => {
  test.skip(!adminPassword, 'Requiere E2E_ADMIN_PASSWORD para publicar y confirmar');
  test.slow();

  const marca = `Cafetería Plan ${Date.now()}`;
  const anonimo = await playwright.request.newContext({ baseURL });
  const creado = await anonimo.post('/api/businesses', {
    data: {
      name: marca,
      category: 'cafeterias',
      categoryIcon: 'Coffee',
      description: 'Negocio de prueba para los planes',
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
  const { business } = (await creado.json()) as { business: { id: string } };

  const apiAdmin = await playwright.request.newContext({ baseURL });
  await apiAdmin.post('/api/auth/login', {
    data: { username: adminUser, password: adminPassword }
  });
  await apiAdmin.patch('/api/businesses', { data: { id: business.id, action: 'approve' } });

  // La cuenta reclama y el administrador la confirma: sin ser dueño no hay planes.
  const cuenta = await crearCuenta();
  await page.request.post(`/api/businesses/${business.id}/claim`, { data: {} });
  const cola = await apiAdmin.get('/api/admin/business-claims');
  const { claims } = (await cola.json()) as {
    claims: { id: string; businessId: string; claimant?: { id: string } }[];
  };
  const suya = claims.find((c) => c.businessId === business.id && c.claimant?.id === cuenta.id);
  expect(suya, 'la solicitud no llegó a la cola').toBeTruthy();
  await apiAdmin.patch(`/api/admin/business-claims/${suya!.id}`, { data: { action: 'confirm' } });

  await page.goto('/');
  await page.getByRole('button', { name: 'Menú principal TransferCuba' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Mis negocios/ }).click();

  const modal = page.getByRole('dialog');
  // Acotado a SU tarjeta: el primer plan de la lista es el de un solo negocio,
  // cuyo botón de confirmar está deshabilitado hasta elegir cuál — con razón.
  const tarjeta = modal.locator('div.rounded-xl').filter({ hasText: 'Cuenta premium' }).first();
  await expect(tarjeta, 'el plan de cuenta no aparece').toBeVisible({ timeout: 30_000 });

  await tarjeta.getByRole('button', { name: /Pedir este plan/ }).click();
  await tarjeta.getByRole('button', { name: /Confirmar pedido/ }).click();

  await expect(modal.getByText(/Un administrador confirmará el pago/)).toBeVisible({
    timeout: 30_000
  });

  // Y lo que cuenta: el pago existe y está pendiente, no activo.
  const suscripciones = await page.request.get('/api/account/subscriptions');
  const { subscriptions } = (await suscripciones.json()) as {
    subscriptions: { planCode: string; status: string }[];
  };
  expect(subscriptions.find((x) => x.planCode === 'owner_account')?.status).toBe('PENDING');

  await anonimo.dispose();
  await apiAdmin.dispose();
});
