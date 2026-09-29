import type { MetadataRoute } from 'next';
import { SITIO } from '@/lib/sitio';

/**
 * Sin esto, `robots.txt` daba 404. No impedía que Google entrara —la ausencia
 * se interpreta como "todo permitido"— pero tampoco le decía dónde está el
 * mapa del sitio, y un directorio vive de que lo indexen.
 *
 * Las rutas de API y del panel se excluyen: no son contenido, y una de ellas
 * es la pantalla de administración.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITIO}/sitemap.xml`,
    host: SITIO
  };
}
