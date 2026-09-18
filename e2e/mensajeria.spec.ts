import { test, expect, hayBaseDePruebas } from './fixtures/cuenta';
import { aislarDeLaRed } from './fixtures/red';

/**
 * Tablón de mensajería: exige sesión con rol MESSENGER y perfil ACTIVE, así
 * que todo esto cuelga del fixture de cuenta. Cubre el patrón ARIA de
 * pestañas que la Fase 6 va a ampliar con una tercera ("Historial").
 *
 * Sin `E2E_DATABASE_URL` no hay dónde crear la cuenta y el bloque se salta
 * entero: no se escribe jamás en la base que la aplicación use por defecto.
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

  await page.getByRole('button', { name: 'Menú principal TransferCuba' }).filter({ visible: true }).first().click();
  const cajon = page.getByRole('dialog');
  await expect(cajon).toBeVisible();

  // El cajón se cierra a sí mismo antes de abrir el tablón, así que aquí no
  // hay dos diálogos: el `role="dialog"` que queda es el del tablón.
  await cajon.getByRole('button', { name: /^Mensajería/ }).click();

  const tablon = page.getByRole('dialog');
  await expect(tablon).toBeVisible();
  return tablon;
}

test('el tablón se anuncia como diálogo y carga con sesión de mensajero', async ({ page, crearCuenta }) => {
  await crearCuenta({ rol: 'MESSENGER' });

  const tablon = await abrirTablon(page);

  await expect(tablon).toHaveAttribute('aria-modal', 'true');
  await expect(tablon).toHaveAccessibleName('Mensajería');
});

test('las pestañas son un tablist ARIA con la selección reflejada', async ({ page, crearCuenta }) => {
  await crearCuenta({ rol: 'MESSENGER' });
  const tablon = await abrirTablon(page);

  const tablist = tablon.getByRole('tablist');
  await expect(tablist).toHaveAttribute('aria-label', 'Vistas de mensajería');

  const pestanas = tablon.getByRole('tab');
  await expect(pestanas).toHaveCount(2);

  const carreras = tablon.getByRole('tab', { name: /Carreras/ });
  const miCarrera = tablon.getByRole('tab', { name: /Mi carrera/ });

  await expect(carreras).toHaveAttribute('aria-selected', 'true');
  await expect(miCarrera).toHaveAttribute('aria-selected', 'false');

  // Tabindex itinerante: solo la pestaña activa es alcanzable con Tab.
  await expect(carreras).toHaveAttribute('tabindex', '0');
  await expect(miCarrera).toHaveAttribute('tabindex', '-1');

  const panel = tablon.getByRole('tabpanel');
  await expect(panel).toHaveCount(1);
});

test('las flechas mueven entre pestañas y dan la vuelta', async ({ page, crearCuenta }) => {
  await crearCuenta({ rol: 'MESSENGER' });
  const tablon = await abrirTablon(page);

  const carreras = tablon.getByRole('tab', { name: /Carreras/ });
  const miCarrera = tablon.getByRole('tab', { name: /Mi carrera/ });

  await carreras.focus();

  await page.keyboard.press('ArrowRight');
  await expect(miCarrera).toBeFocused();
  await expect(miCarrera).toHaveAttribute('aria-selected', 'true');
  await expect(carreras).toHaveAttribute('aria-selected', 'false');

  // Con solo dos pestañas, otra flecha derecha vuelve al principio.
  await page.keyboard.press('ArrowRight');
  await expect(carreras).toBeFocused();
  await expect(carreras).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowLeft');
  await expect(miCarrera).toBeFocused();
  await expect(miCarrera).toHaveAttribute('aria-selected', 'true');
});

test('el panel activo queda etiquetado por la pestaña seleccionada', async ({ page, crearCuenta }) => {
  await crearCuenta({ rol: 'MESSENGER' });
  const tablon = await abrirTablon(page);

  const panel = tablon.getByRole('tabpanel');
  await expect(panel).toHaveAttribute('aria-labelledby', 'messenger-tab-available');

  await tablon.getByRole('tab', { name: /Mi carrera/ }).click();
  await expect(panel).toHaveAttribute('aria-labelledby', 'messenger-tab-active');
});

test('los estados vacíos ofrecen una salida, no solo texto', async ({ page, crearCuenta }) => {
  await crearCuenta({ rol: 'MESSENGER' });
  const tablon = await abrirTablon(page);

  // Base de pruebas limpia: ni carreras disponibles ni carrera asignada.
  await expect(tablon.getByText('No hay carreras pendientes')).toBeVisible();

  await tablon.getByRole('tab', { name: /Mi carrera/ }).click();
  await expect(tablon.getByText('No tienes una carrera activa')).toBeVisible();

  const volver = tablon.getByRole('button', { name: 'Ver carreras disponibles' });
  await expect(volver).toBeVisible();
  await volver.click();

  await expect(tablon.getByRole('tab', { name: /Carreras/ })).toHaveAttribute('aria-selected', 'true');
});

test('el diálogo sigue cumpliendo el contrato de la carcasa', async ({ page, crearCuenta }) => {
  await crearCuenta({ rol: 'MESSENGER' });
  const tablon = await abrirTablon(page);

  const cerrar = tablon.getByRole('button', { name: 'Cerrar mensajería' });
  const caja = await cerrar.boundingBox();
  expect(caja).not.toBeNull();
  expect(caja!.width).toBeGreaterThanOrEqual(44);
  expect(caja!.height).toBeGreaterThanOrEqual(44);

  await page.keyboard.press('Escape');
  await expect(tablon).toBeHidden();
});
