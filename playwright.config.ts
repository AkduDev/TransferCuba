import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',

  // Los artefactos van FUERA del proyecto: escribirlos dentro despierta al
  // watcher de `next dev`, que recompila a mitad de la suite y deja
  // navegaciones colgadas. El camino se imprime al fallar una prueba.
  outputDir: path.join(os.tmpdir(), 'transfercuba-playwright'),

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,

  // Serial a propósito: architecture.md documenta que el disco NTFS de
  // desarrollo escribe a ~11 MB/s, así que varios workers contra un único
  // `next dev` compiten por I/O y producen timeouts, no paralelismo.
  workers: 1,

  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    video: 'off'
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // `next dev`, no `next build`: la build completa tarda ~8 min en este
    // disco. En CI el FS es nativo, pero el dev server basta para lo que
    // estas pruebas comprueban.
    command: `bunx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
