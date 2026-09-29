/**
 * URL pública del sitio, sin barra final.
 *
 * En una variable porque `robots.txt`, el mapa del sitio y las etiquetas
 * sociales tienen que coincidir: si divergen, Google indexa una cosa y
 * comparte otra. El día que haya dominio propio se cambia aquí y en
 * `NEXT_PUBLIC_SITE_URL`, no en cuatro ficheros.
 */
export const SITIO = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://transfercuba.vercel.app'
).replace(/\/$/, '');
