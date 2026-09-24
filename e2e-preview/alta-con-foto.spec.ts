import { test, expect } from './fixtures/preview';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

/**
 * La última milla: dar de alta un negocio **pulsando el formulario**, con una
 * foto real subida desde el navegador a Cloudinary.
 *
 * Corre contra un despliegue de Preview de verdad, que apunta a la rama
 * `preview` de Neon: se puede ensuciar sin tocar producción. Es lo único que
 * las pruebas contra el dev server no pueden demostrar — que las variables
 * `NEXT_PUBLIC_CLOUDINARY_*` llegaron al bundle desplegado y que la subida
 * cruza de verdad hasta Cloudinary.
 *
 * Lo que cree se borra en `docs/operaciones.md` (limpieza manual) o desde el
 * propio script que lanza esta prueba.
 */

const NOMBRE = `Cafetería Clics ${Date.now()}`;

/** PNG 8×8 mínimo, sin dependencias: el fichero que se sube de verdad. */
function pngDePrueba(): string {
  const w = 8;
  const h = 8;
  const crcTabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const trozo = (tipo: string, datos: Buffer) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const filas: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    filas.push(Buffer.concat([Buffer.from([0]), Buffer.from(Array(w * 3).fill(0).map((_, i) => (i % 3 === 1 ? 0xc0 : 0x20)))]));
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(Buffer.concat(filas))),
    trozo('IEND', Buffer.alloc(0))
  ]);

  const ruta = join(mkdtempSync(join(tmpdir(), 'tc-foto-')), 'local.png');
  writeFileSync(ruta, png);
  return ruta;
}

test('un negocio se registra con foto pulsando el formulario', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  // Diagnóstico de la subida: sin esto, un fallo solo dice "no apareció la
  // miniatura" y hay que adivinar por qué.
  const respuestasCloudinary: string[] = [];
  page.on('response', async (r) => {
    if (!r.url().includes('api.cloudinary.com')) return;
    const cuerpo = await r.text().catch(() => '<sin cuerpo>');
    respuestasCloudinary.push(`${r.status()} ${cuerpo.slice(0, 300)}`);
  });
  page.on('console', (m) => {
    if (/csp|content security|cloudinary/i.test(m.text())) respuestasCloudinary.push(`CONSOLA ${m.text().slice(0, 200)}`);
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('cloudinary')) {
      respuestasCloudinary.push(`FALLÓ ${r.failure()?.errorText} ${r.url().slice(0, 80)}`);
    }
  });

  await page.goto('/');

  // 1. Abrir el formulario desde el control flotante del mapa.
  await page.getByRole('button', { name: /Registrar/ }).filter({ visible: true }).first().click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAccessibleName(/Haz visible tu negocio/);

  // 2. Paso 1/5 (Negocio): nombre. La categoría queda por defecto.
  await modal.getByPlaceholder('ej. Café & Market Habana').fill(NOMBRE);
  await modal.getByRole('button', { name: /^Continuar/ }).click();

  // 3. Paso 2/5 (Ubicación): dirección. Sin pin, el formulario usa el
  //    centro de la provincia.
  await modal.getByPlaceholder('ej. Calle 23 #456 e/ J e I').fill('Calle 23 #456 e/ J e I, Vedado');
  await modal.getByRole('button', { name: /^Continuar/ }).click();

  // 4. Paso 3/5 (Pagos): los valores por defecto ya son válidos.
  await expect(modal.getByText(/¿Están recibiendo transferencia/)).toBeVisible();
  await modal.getByRole('button', { name: /^Continuar/ }).click();

  // 5. Paso 4/5 (Contacto): WhatsApp obligatorio + fijo opcional.
  await modal.getByPlaceholder(/5284 9102/).first().fill('+53 5284 9102');
  await modal.getByPlaceholder(/7830 1234/).first().fill('+53 7830 1234');
  await modal.getByRole('button', { name: /^Continuar/ }).click();

  // 6. Paso 5/5 (Fotos): la prueba de fuego es subir una foto de verdad
  //    desde el navegador. Si las NEXT_PUBLIC_CLOUDINARY_* no hubieran
  //    llegado al bundle, aquí saldría "Fotos no configuradas".
  await expect(modal.getByText(/Fotos no configuradas/)).toBeHidden();
  await modal.locator('input[type="file"]').setInputFiles(pngDePrueba());

  // La miniatura solo aparece cuando Cloudinary ha respondido con la URL.
  const miniatura = modal.locator('img[src*="res.cloudinary.com"]').first();
  try {
    await expect(miniatura).toBeVisible({ timeout: 60_000 });
  } catch (e) {
    // El componente muestra el motivo en pantalla; se recoge junto con lo que
    // respondió Cloudinary para que el fallo sea accionable.
    const enPantalla = await modal
      .locator('p,div')
      .filter({ hasText: /Error|excede|configurad/i })
      .allInnerTexts()
      .catch(() => []);
    throw new Error(
      `La foto no llegó a subirse a Cloudinary.\n` +
        `  Respuestas de Cloudinary: ${JSON.stringify(respuestasCloudinary)}\n` +
        `  Mensajes en pantalla: ${JSON.stringify(enPantalla.slice(0, 3))}\n` +
        `  Original: ${(e as Error).message.split('\n')[0]}`
    );
  }
  const urlFoto = await miniatura.getAttribute('src');
  expect(urlFoto).toContain('res.cloudinary.com');

  // 7. Enviar.
  await modal.getByRole('button', { name: /Enviar para revisión/ }).click();

  // El modal se cierra al registrarse; si la validación fallara seguiría abierto.
  await expect(modal, 'el formulario no se cerró: el alta no se completó').toBeHidden({
    timeout: 60_000
  });

  expect(errores, `errores de JavaScript en la página: ${errores.join(' | ')}`).toEqual([]);

  // El nombre y la URL quedan por escrito para que el script que lanza esta
  // prueba pueda comprobarlos en la base y limpiarlos después.
  console.log(`__NEGOCIO__ ${NOMBRE}`);
  console.log(`__FOTO__ ${urlFoto}`);
});
