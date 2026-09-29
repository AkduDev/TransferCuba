import type { MetadataRoute } from 'next';
import { SITIO } from '@/lib/sitio';

/**
 * Hoy son tres páginas. Crecerá cuando cada negocio tenga su URL propia, que
 * es lo que de verdad trae tráfico de búsqueda a un directorio; esta función
 * es el sitio donde enchufarlas.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();
  return [
    { url: SITIO, lastModified: ahora, changeFrequency: 'daily', priority: 1 },
    { url: `${SITIO}/terminos`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITIO}/privacidad`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.3 }
  ];
}
