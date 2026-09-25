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
function huellaDelMapaBase(): string | undefined {
  try {
    const bytes = readFileSync(join(process.cwd(), 'public', 'map', 'cuba.pmtiles'));
    return createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  } catch {
    return undefined;
  }
}

const PMTILES_VERSION = huellaDelMapaBase();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  env: PMTILES_VERSION ? { NEXT_PUBLIC_PMTILES_VERSION: PMTILES_VERSION } : {},
  async headers() {
    if (!PMTILES_VERSION) return [];
    return [
      {
        source: '/map/cuba.pmtiles',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
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
