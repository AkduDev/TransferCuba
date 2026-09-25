import { test, expect } from '@playwright/test';

/**
 * El tirador del panel móvil.
 *
 * Era un <div> con onClick y un aria-label: sin `role` ese label lo ignora la
 * mayoría de lectores de pantalla, y sin `tabIndex` no había forma de llegar
 * con el teclado. En la vista de lista es el ÚNICO control que expande el
 * panel —en la ficha de un negocio hay además un botón con chevron—, así que
 * el panel entero quedaba fuera del alcance del teclado.
 */

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
});

test('el tirador es un botón alcanzable por teclado', async ({ page }) => {
  const tirador = page.getByRole('button', { name: 'Expandir panel' });
  await expect(tirador).toBeVisible();

  await tirador.focus();
  await expect(tirador).toBeFocused();

  // Enter, no clic: es lo que no funcionaba.
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Expandir panel del todo' })).toBeVisible();
});

test('el estado del panel se anuncia y apunta a lo que despliega', async ({ page }) => {
  const cerrado = page.getByRole('button', { name: 'Expandir panel' });
  await expect(cerrado).toHaveAttribute('aria-expanded', 'false');

  const controla = await cerrado.getAttribute('aria-controls');
  expect(controla, 'aria-controls vacío').toBeTruthy();
  // Por atributo y no por `#id`: useId genera ids con dos puntos (`:r0:`),
  // que en un selector CSS habría que escapar.
  await expect(
    page.locator(`[id="${controla}"]`),
    'aria-controls apunta a un id que no existe'
  ).toHaveCount(1);

  await cerrado.click();
  const medio = page.getByRole('button', { name: 'Expandir panel del todo' });
  await expect(medio).toHaveAttribute('aria-expanded', 'true');

  await medio.click();
  const abierto = page.getByRole('button', { name: 'Contraer panel' });
  await expect(abierto).toHaveAttribute('aria-expanded', 'true');

  // El ciclo vuelve al principio: full -> peek.
  await abierto.click();
  await expect(cerrado).toBeVisible();
});
