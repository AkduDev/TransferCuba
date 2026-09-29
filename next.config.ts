import type {NextConfig} from 'next';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Huella del mapa base, para poder cachearlo un año.
//
// `public/` no lleva huella en el nombre, así que Next lo sirve con
// `max-age=0, must-revalidate`: medido en producción, reabrir la aplicación
// re-descargaba ~3,7 MB de un fichero de 85 MB que no había cambiado.
//
// Poner `immutable` a secas sería una trampa: el día que se regenere el mapa,
// quien lo tuviera cacheado se quedaría con el viejo durante un año y no hay
// forma de purgarlo. Con la huella en la URL, regenerar el fichero cambia la
// URL y el problema de invalidación se vuelve uno de nombres.
//
// Si el fichero no está, no se versiona Y TAMPOCO se cachea largo: las dos
// cosas van juntas o no va ninguna.
function huella(...rutas: string[]): string | undefined {
  try {
    const h = createHash('sha256');
    for (const r of rutas) h.update(readFileSync(join(process.cwd(), ...r.split('/'))));
    return h.digest('hex').slice(0, 12);
  } catch {
    return undefined;
  }
}

const PMTILES_VERSION = huella('public/map/cuba.pmtiles');

// El resto de `/map/` tenía el mismo problema que el mapa base y se quedó sin
// arreglar: medido en producción, las fuentes de emoji son 667 KB en 6
// peticiones y se servían con `max-age=0, must-revalidate`, igual que el
// estilo. Una huella común basta porque se regeneran juntos: el estilo declara
// las caras y los rangos de esas fuentes, así que cambiar una sin la otra
// sería incoherente de todos modos.
const MAP_ASSETS_VERSION = huella(
  'public/map/transfercuba-style.json',
  'public/map/style.json',
  ...Array.from({ length: 10 }, (_, i) => `public/map/fonts/emoji-${i}.woff2`)
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  env: {
    ...(PMTILES_VERSION ? { NEXT_PUBLIC_PMTILES_VERSION: PMTILES_VERSION } : {}),
    ...(MAP_ASSETS_VERSION ? { NEXT_PUBLIC_MAP_ASSETS_VERSION: MAP_ASSETS_VERSION } : {})
  },
  async headers() {
    const UN_ANIO = 'public, max-age=31536000, immutable';
    const reglas: { source: string; headers: { key: string; value: string }[] }[] = [];

    // Versionado y caché larga van SIEMPRE juntos: sin huella en la URL, un
    // `immutable` deja a quien lo tenga cacheado con la versión vieja un año.
    if (MAP_ASSETS_VERSION) {
      reglas.push(
        { source: '/map/fonts/:fichero*', headers: [{ key: 'Cache-Control', value: UN_ANIO }] },
        { source: '/map/:estilo(transfercuba-style.json|style.json)', headers: [{ key: 'Cache-Control', value: UN_ANIO }] }
      );
    }
    if (!PMTILES_VERSION) return reglas;
    return [
      ...reglas,
      {
        source: '/map/cuba.pmtiles',
        headers: [{ key: 'Cache-Control', value: UN_ANIO }]
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
};

export default nextConfig;
