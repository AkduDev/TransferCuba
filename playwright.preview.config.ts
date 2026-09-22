import path from 'node:path';
import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración para ejercitar un despliegue REAL de Vercel (Preview), no el
 * dev server. Se usa con `e2e-preview/`, aparte de la suite normal.
 *
 * Dos diferencias con `playwright.config.ts`:
 *  - No levanta `webServer`: el objetivo ya está desplegado.
 *  - El token de SSO no va aquí: los despliegues de Preview están tras la
 *    protección de Vercel y sin él cada navegación acaba en un 302 a
 *    `vercel.com/sso-api`, pero `extraHTTPHeaders` lo mandaría TAMBIÉN a
 *    terceros. Lo inyecta `e2e-preview/fixtures/preview.ts`, solo al origen de
 *    Vercel. El token sale de `vercel env run`, es de corta vida y NO se
 *    escribe en disco.
 *
 * Uso:
 *   vercel env run -- sh -c 'PREVIEW_URL=<url> bunx playwright test \
 *     --config playwright.preview.config.ts'
 */

const baseURL = process.env.PREVIEW_URL;
const oidc = process.env.VERCEL_OIDC_TOKEN;

if (!baseURL) throw new Error('Falta PREVIEW_URL');
if (!oidc) throw new Error('Falta VERCEL_OIDC_TOKEN (lánzalo dentro de `vercel env run`)');

export default defineConfig({
  testDir: './e2e-preview',
  outputDir: path.join(os.tmpdir(), 'transfercuba-playwright-preview'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 180_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL,
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
    trace: 'retain-on-failure'
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
