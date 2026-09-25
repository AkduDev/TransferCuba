import { test, expect } from '@playwright/test';

/**
 * El mapa base (`public/map/cuba.pmtiles`, 85 MB) se sirve `immutable` durante
 * un año. Eso solo es seguro si la URL lleva la huella del contenido: si no,
 * el día que se regenere el fichero los clientes que lo tengan cacheado se
 * quedarían con el viejo y no hay forma de purgarlo.
 *
 * El fallo sería silencioso —el mapa sigue pintando, solo que desactualizado—
 * así que conviene que algo lo vigile.
 */
test('el mapa base se pide con la huella en la URL', async ({ page }) => {
  const peticiones: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('cuba.pmtiles')) peticiones.push(r.url());
  });

  await page.goto('/');
  await expect
    .poll(() => peticiones.length, { timeout: 30_000, message: 'el mapa no pidió el fichero base' })
    .toBeGreaterThan(0);

  for (const url of peticiones) {
    expect(url, 'sin huella, el `immutable` del mapa base es una trampa').toMatch(/[?&]v=[0-9a-f]{12}\b/);
  }
});
