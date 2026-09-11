// Genera public/sw.js (Workbox) tras `next build`.
// Precache de los chunks estáticos + microtiles del worker del mapa, y
// runtime caching: API GET (stale-while-revalidate), cuba.pmtiles con
// soporte de rangos HTTP (CacheFirst + RangeRequestsPlugin), imágenes.
// Sprint 5 — offline y arranque instántaneo en conectividad restringida.
import { generateSW } from 'workbox-build';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const revisions = (relPath) => {
  const abs = resolve(process.cwd(), relPath);
  if (!existsSync(abs)) return null;
  const hash = createHash('md5').update(readFileSync(abs)).digest('hex');
  // public/ se sirve en la raíz: 'public/map/x.mjs' -> '/map/x.mjs'
  const url = relPath.startsWith('public/') ? `/${relPath.slice('public/'.length)}` : `/${relPath}`;
  return { url, revision: hash };
};

// HTML prerenderizado de la página raíz. En Next las rutas se sirven sin
// extensión: el precache usa la URL '/' (no '/index.html', que da 404 y
// descarrilaba el install del SW). navigateFallback lo usa offline.
const rootHtml = resolve(process.cwd(), '.next/server/app/index.html');
const rootIndex = { url: '/', revision: createHash('md5').update(readFileSync(rootHtml)).digest('hex') };

generateSW({
  swDest: 'public/sw.js',
  globDirectory: '.next',
  globPatterns: ['static/**/*.{js,css,svg,woff2}'],
  dontCacheBustURLsMatching: /[a-f0-9]{8,}-/,
  modifyURLPrefix: { static: '/_next/static' },
  additionalManifestEntries: [
    rootIndex,
    revisions('public/map/maplibre-gl-worker.mjs'),
    revisions('public/map/maplibre-gl-shared.mjs'),
    revisions('public/map/style.json'),
  ].filter(Boolean),
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  navigateFallback: '/',
  runtimeCaching: [
    {
      // NOTA: cuba.pmtiles NO se cachea a propósito. El protocolo pmtiles
      // solo emite range requests (206) y Cache.put rechaza 206 parciales,
      // así que CacheFirst+RangeRequests solo funciona con el archivo
      // ÍNTEGRO en cache; bajarlo completo son 89 MB que quemarían el
      // bandwidth free de Vercel (~1000 usuarios/vistas). Los tiles se
      // sirven del CDN online (línea PMTiles); offline el basemap degrada
      // a gris pero shell + datos siguen disponibles (Sprint 5 tradeoff).
      // Abandon: cuba.pmtiles viaja por la red; Vercel CDN ya cachea rangos.
      // Datos de negocios: primero cache, se refresca en background.
      urlPattern: ({ url }) => url.pathname.startsWith('/api/businesses'),
      handler: 'StaleWhileRevalidate',
      method: 'GET',
      options: {
        cacheName: 'api-data',
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Fotos externas (opcionales): cache-first, nunca bloquean.
      urlPattern: ({ url, request }) =>
        request.destination === 'image' && !url.pathname.startsWith('/map/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Style/glyphs remotos de OpenFreeMap: caché para arranque offline-cosmético.
      urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'openfreemap',
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
})
  .then(({ count, size }) => {
    console.log(
      `[build-sw] public/sw.js generado: ${count} URLs precacheadas (${(size / 1024).toFixed(0)} KB)`
    );
    // Con output:'standalone', next copia public/ durante el build, ANTES de
    // este script. Replicar los SW en el directorio standalone para que el
    // server autónomo los sirva también (self-hosting).
    const standalonePublic = resolve(process.cwd(), '.next/standalone/public');
    if (existsSync(standalonePublic)) {
      const swFiles = ['sw.js', ...readdirSync(resolve(process.cwd(), 'public')).filter((f) => f.startsWith('workbox-'))];
      swFiles.forEach((f) => copyFileSync(resolve(process.cwd(), 'public', f), resolve(standalonePublic, f)));
      console.log(`[build-sw] copiados ${swFiles.length} archivos SW a .next/standalone/public`);
    }
  })
  .catch((err) => {
    console.error('[build-sw] fallo al generar el service worker:', err);
    process.exit(1);
  });