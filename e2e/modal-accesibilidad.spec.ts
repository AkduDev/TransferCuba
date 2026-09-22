import { test, expect, type Locator, type Page } from '@playwright/test';
import { aislarDeLaRed } from './fixtures/red';

/**
 * Contrato de accesibilidad de `components/ModalShell.tsx`.
 *
 * Se ejercita sobre el modal de filtros y el cajón lateral porque son las dos
 * únicas superficies que abren sin sesión: el resto exige cuenta, y dos de
 * ellas además un rol concreto. Lo que se comprueba aquí (semántica de
 * diálogo, Escape, trampa de foco, devolución del foco, clic en el fondo,
 * bloqueo del scroll) vive en la carcasa compartida, así que vale para los
 * ocho consumidores.
 */

const CERULEAN = 'rgb(2, 132, 199)'; // --color-cerulean, el anillo de foco

async function abrir(page: Page, nombreDelBoton: string): Promise<{ trigger: Locator; dialog: Locator }> {
  const trigger = page.getByRole('button', { name: nombreDelBoton }).filter({ visible: true }).first();
  await expect(trigger).toBeVisible();
  // Con teclado, no con ratón: `:focus-visible` depende de la última modalidad
  // de interacción, y una de las pruebas mide precisamente el anillo de foco.
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

/** ¿El foco sigue dentro del diálogo? */
function focoDentroDelDialogo(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const activo = document.activeElement;
    return Boolean(dialog && activo && dialog.contains(activo));
  });
}

test.beforeEach(async ({ page }) => {
  await aislarDeLaRed(page);
  await page.goto('/');
});

test.describe('Modal de filtros', () => {
  test('se anuncia como diálogo modal con nombre accesible', async ({ page }) => {
    const { dialog } = await abrir(page, 'Filtros avanzados');

    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // El nombre sale de aria-labelledby → <h3 id="filters-modal-title">.
    await expect(dialog).toHaveAccessibleName('Filtros');
  });

  test('al abrir, el foco entra en el diálogo', async ({ page }) => {
    await abrir(page, 'Filtros avanzados');
    expect(await focoDentroDelDialogo(page)).toBe(true);
  });

  test('Escape cierra y devuelve el foco a quien lo abrió', async ({ page }) => {
    const { trigger, dialog } = await abrir(page, 'Filtros avanzados');

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Tab no se escapa del diálogo', async ({ page }) => {
    await abrir(page, 'Filtros avanzados');

    // Más pulsaciones que controles tiene el panel, para dar la vuelta entera
    // al menos una vez y detectar una fuga en cualquier punto del ciclo.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      expect(await focoDentroDelDialogo(page), `el foco se escapó en el Tab nº ${i + 1}`).toBe(true);
    }
  });

  test('Shift+Tab tampoco se escapa por el principio', async ({ page }) => {
    await abrir(page, 'Filtros avanzados');

    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focoDentroDelDialogo(page), `el foco se escapó en el Shift+Tab nº ${i + 1}`).toBe(true);
    }
  });

  test('el foco de teclado es visible y usa el color de marca', async ({ page }) => {
    await abrir(page, 'Filtros avanzados');
    await page.keyboard.press('Tab');

    // Se sondea en vez de leer una sola vez: `transition-colors` incluye
    // `outline-color`, así que una lectura inmediata puede caer a mitad de la
    // transición de 150 ms y devolver el `currentColor` de partida.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const activo = document.activeElement as HTMLElement | null;
          if (!activo) return null;
          const s = getComputedStyle(activo);
          return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
        })
      )
      .toBe(`solid 2px ${CERULEAN}`);
  });

  test('el clic en el fondo cierra', async ({ page }) => {
    const { dialog } = await abrir(page, 'Filtros avanzados');

    await page.mouse.click(5, 5);

    await expect(dialog).toBeHidden();
  });

  test('arrastrar desde dentro hasta el fondo NO cierra', async ({ page }) => {
    const { dialog } = await abrir(page, 'Filtros avanzados');
    const caja = await dialog.boundingBox();
    expect(caja).not.toBeNull();

    // Seleccionar texto dentro del panel y soltar fuera es el gesto que un
    // `onClick` en la capa cerraría por error.
    await page.mouse.move(caja!.x + 40, caja!.y + 40);
    await page.mouse.down();
    await page.mouse.move(5, 5, { steps: 10 });
    await page.mouse.up();

    await expect(dialog).toBeVisible();
  });

  test('bloquea el scroll de la página y lo restaura al cerrar', async ({ page }) => {
    const antes = await page.evaluate(() => document.body.style.overflow);

    const { dialog } = await abrir(page, 'Filtros avanzados');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(antes);
  });

  test('el botón de cerrar cumple el objetivo táctil de 44 px', async ({ page }) => {
    const { dialog } = await abrir(page, 'Filtros avanzados');

    const caja = await dialog.getByRole('button', { name: 'Cerrar filtros' }).boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.width).toBeGreaterThanOrEqual(44);
    expect(caja!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Cajón lateral', () => {
  test('usa la misma carcasa: diálogo, Escape y devolución del foco', async ({ page }) => {
    const { trigger, dialog } = await abrir(page, 'Menú principal TransferCuba');

    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // El título del cajón se parte en dos <span> ("Transfer" + "Cuba"), así que
    // el nombre accesible que se compone lleva el espacio: "Transfer Cuba".
    await expect(dialog).toHaveAccessibleName(/Transfer\s*Cuba/);
    expect(await focoDentroDelDialogo(page)).toBe(true);

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('queda anclado a la izquierda, no centrado', async ({ page }) => {
    const { dialog } = await abrir(page, 'Menú principal TransferCuba');

    const caja = await dialog.boundingBox();
    expect(caja).not.toBeNull();
    // alignClassName="items-stretch justify-start": pegado al borde izquierdo
    // y a toda la altura de la ventana.
    expect(caja!.x).toBe(0);
    const alto = page.viewportSize()!.height;
    expect(caja!.height).toBe(alto);
  });
});
