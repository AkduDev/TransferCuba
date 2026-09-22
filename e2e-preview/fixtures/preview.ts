import { test as base, expect } from '@playwright/test';

/**
 * El token de SSO **solo** puede viajar al origen de Vercel.
 *
 * `extraHTTPHeaders` de Playwright se aplica a todas las peticiones del
 * contexto, incluida la POST cross-origin a `api.cloudinary.com`. Una cabecera
 * no estándar convierte esa POST en una petición con preflight, Cloudinary no
 * declara `x-vercel-trusted-oidc-idp-token` en `Access-Control-Allow-Headers`,
 * el preflight falla y la subida muere con `net::ERR_FAILED` — sin respuesta
 * HTTP que mirar. La aplicación no tenía nada que ver.
 *
 * Además de romper la prueba, mandar el token a terceros es filtrarlo.
 */

const oidc = process.env.VERCEL_OIDC_TOKEN;

export const test = base.extend({
  page: async ({ page, baseURL }, usar) => {
    const origenVercel = new URL(baseURL!).origin;

    await page.route('**/*', async (route) => {
      const destino = new URL(route.request().url()).origin;
      if (destino !== origenVercel) return route.continue();
      await route.continue({
        headers: { ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': oidc! }
      });
    });

    await usar(page);
  }
});

export { expect };
