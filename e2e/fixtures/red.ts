import type { Page } from '@playwright/test';

/**
 * Deja fuera lo que no es del mismo origen: teselas, glifos de OpenFreeMap,
 * OSRM y Nominatim. Las pruebas quedan herméticas y no dependen ni de la red
 * ni del SLA de terceros — OSRM se usa sin API key y sin garantías.
 */
export async function aislarDeLaRed(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    const esLocal = hostname === '127.0.0.1' || hostname === 'localhost';
    return esLocal ? route.continue() : route.abort();
  });
}
