import { test, expect } from '@playwright/test';

/**
 * Dos regresiones que el navegador —no el servidor— provocaba.
 *
 * 1. El campo de contraseña llevaba `minLength={8}` sin condicionar al modo,
 *    dentro de un <form> sin `noValidate`. Las cuentas creadas cuando el alta
 *    pedía un PIN de 4–8 dígitos quedaban fuera: el navegador bloqueaba el
 *    envío y la petición no llegaba a salir. `/api/account/login` nunca validó
 *    longitud, así que el arreglo es solo de formulario.
 *
 * 2. Las categorías tenían el emoji escrito en tres sitios distintos y
 *    contradictorios. La ficha móvil pintaba `categoryIcon`, que guarda el
 *    NOMBRE del icono de Lucide, así que mostraba la palabra "ShoppingBag".
 *
 * Sin base de datos: en desarrollo `useBusinessesData` cae a INITIAL_BUSINESSES
 * y el login solo necesita que la petición salga, no que acierte.
 */

const NOMBRES_DE_ICONO = ['ShoppingBag', 'Utensils', 'Smartphone', 'Pill', 'Coffee', 'Wrench', 'Shirt'];

async function abrirCuenta(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menú principal TransferCuba' }).first().click();
  // Acotado al cajón: en móvil hay además un chip "Mi cuenta" en la barra.
  const cajon = page.getByRole('dialog');
  await cajon.getByRole('button', { name: /Mi cuenta/ }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  return modal;
}

test('una contraseña corta llega al servidor al iniciar sesión', async ({ page }) => {
  const modal = await abrirCuenta(page);

  await modal.getByPlaceholder('ej. 5355551234').fill('5355551234');
  await modal.getByPlaceholder('Tu contraseña').fill('1234');

  // La prueba es que la petición SALE. Que responda 401 es lo correcto: la
  // cuenta no existe. Lo que no puede volver a pasar es que no haya petición.
  const peticion = page.waitForRequest(
    (r) => r.url().includes('/api/account/login') && r.method() === 'POST',
    { timeout: 15_000 }
  );
  // Dentro del <form>: el mismo texto está también en la pestaña de modo.
  await modal.locator('form').getByRole('button', { name: /Iniciar sesión/ }).click();
  await expect(peticion, 'el navegador bloqueó el envío: el PIN corto no llega al servidor').resolves
    .toBeTruthy();
});

test('el alta sigue exigiendo 8 caracteres, también a 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const modal = await abrirCuenta(page);
  await modal.getByRole('button', { name: /Crear cuenta|Registr/ }).first().click();

  const clave = modal.getByPlaceholder('Mínimo 8 caracteres');
  await expect(clave, 'el modo registro debe seguir avisando del mínimo').toBeVisible();
  await expect(clave).toHaveAttribute('minlength', '8');

  // El aviso del mínimo solo existe en alta, así que la etiqueta cambia de
  // largo entre modos: en el móvil es donde se notaría un desbordamiento.
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(desborda, 'el modal de cuenta desborda a lo ancho en móvil').toBe(false);
});

test('las categorías se pintan con emoji, nunca con el nombre del icono', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Filtros avanzados' }).first().click();

  const filtros = page.getByRole('dialog');
  await expect(filtros).toBeVisible();

  const texto = (await filtros.innerText()).replace(/\s+/g, ' ');
  for (const nombre of NOMBRES_DE_ICONO) {
    expect(texto, `los filtros muestran "${nombre}" en vez de un emoji`).not.toContain(nombre);
  }
  // Los emoji del mapa y los de los filtros salen ahora del mismo sitio.
  expect(texto).toContain('🛒');
  expect(texto).toContain('🍔');
});

test('la ficha móvil muestra el emoji de la categoría', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  const tirador = page.getByRole('button', { name: 'Expandir panel' });
  const hoja = tirador.locator('..');
  await tirador.click();

  // Acotado a la hoja: el ExplorePanel de escritorio sigue en el DOM a 360 px,
  // oculto por CSS, y un `.first()` global aterriza ahí.
  await hoja.getByRole('heading', { name: 'La Esquina Market' }).click();

  const resumen = hoja.getByRole('heading', { level: 3, name: 'La Esquina Market' }).locator('..');
  await expect(resumen).toBeVisible();
  const texto = await resumen.innerText();
  expect(texto, 'la ficha pinta el nombre del icono de Lucide como texto').not.toContain('ShoppingBag');
  expect(texto).toContain('🛒');
});
