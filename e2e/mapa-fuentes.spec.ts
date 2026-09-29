import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El mapa acota las caras de fuente de emoji a los codepoints que de verdad
 * pinta (`EMOJI_DEL_MAPA` en MapLibreMap). Medido: el estilo pedía 667 KB en 6
 * ficheros, y una de esas caras declaraba cubrir los DÍGITOS, así que cualquier
 * etiqueta con un número arrastraba una fuente de emoji entera.
 *
 * El modo de fallo de ese recorte es **silencioso**: si alguien añade una
 * categoría con un emoji nuevo y no lo declara, ese emoji simplemente deja de
 * dibujarse en el mapa y nadie se entera hasta que un dueño se queja.
 *
 * Por eso esto se comprueba leyendo los ficheros y no con un navegador: es una
 * invariante entre tres sitios —el SQL de la tesela, CATEGORY_EMOJI y la lista
 * del componente— y un pixel en un canvas WebGL no la demuestra.
 */

const raiz = process.cwd();
const leer = (...p: string[]) => readFileSync(join(raiz, ...p), 'utf-8');

/** Todo emoji que una etiqueta del mapa puede llegar a contener. */
function emojiQueElMapaPuedeEmitir(): Set<string> {
  const sql = leer('db', 'migrate_featured_from_plans.sql');
  const bloque = sql.slice(sql.indexOf('CASE b.category'), sql.indexOf('END) AS label'));
  const delSql = [
    ...bloque.matchAll(/THEN '([^']+)'/g),
    ...bloque.matchAll(/ELSE '([^']+)'/g)
  ].map((m) => m[1]);

  const datos = leer('lib', 'cuba-data.ts');
  const mapa = /CATEGORY_EMOJI[^{]*\{([\s\S]*?)\n\};/.exec(datos);
  const delMapa = [...(mapa?.[1] ?? '').matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);

  const componente = leer('components', 'MapLibreMap.tsx');
  const respaldos = [...componente.matchAll(/CATEGORY_EMOJI\[[^\]]+\]\s*\?\?\s*'([^']+)'/g)].map(
    (m) => m[1]
  );

  return new Set([...delSql, ...delMapa, ...respaldos].flatMap((s) => [...s]));
}

function codepointsDeclarados(): Set<number> {
  const componente = leer('components', 'MapLibreMap.tsx');
  const lista = /EMOJI_DEL_MAPA = \[([\s\S]*?)\]/.exec(componente)?.[1] ?? '';
  return new Set([...lista.matchAll(/'([0-9A-Fa-f]+)'/g)].map((m) => parseInt(m[1], 16)));
}

function cubre(rango: string, punto: number): boolean {
  const limpio = rango.replace(/^U\+/i, '');
  if (limpio.includes('-')) {
    const [a, b] = limpio.split('-');
    return parseInt(a, 16) <= punto && punto <= parseInt(b, 16);
  }
  return parseInt(limpio, 16) === punto;
}

test('cada emoji del mapa está declarado y tiene una cara que lo cubre', () => {
  const emoji = emojiQueElMapaPuedeEmitir();
  expect(emoji.size, 'no se encontró ningún emoji: los patrones de lectura se han quedado atrás').
    toBeGreaterThan(5);

  const declarados = codepointsDeclarados();
  const sinDeclarar = [...emoji].filter((c) => !declarados.has(c.codePointAt(0)!));
  expect(
    sinDeclarar,
    `emoji que el mapa emite pero EMOJI_DEL_MAPA no declara: ${sinDeclarar.join(' ')} — no se dibujarían`
  ).toEqual([]);

  const estilo = JSON.parse(leer('public', 'map', 'transfercuba-style.json')) as {
    'font-faces': Record<string, { url: string; 'unicode-range'?: string[] }[]>;
  };
  const caras = estilo['font-faces']['Noto Sans Regular'];

  const sinCobertura = [...emoji].filter((c) => {
    const punto = c.codePointAt(0)!;
    return !caras.some((cara) => (cara['unicode-range'] ?? []).some((r) => cubre(r, punto)));
  });
  expect(
    sinCobertura,
    `emoji sin ninguna cara que lo cubra en el estilo: ${sinCobertura.join(' ')}`
  ).toEqual([]);
});

test('la lista declarada solo contiene emoji, nunca dígitos', () => {
  // Esta es la razón del recorte: una cara del estilo cubre U+30-39, así que
  // "Calle 23" bastaba para bajarse 63 KB de fuente de emoji. El recorte lo
  // evita mientras la lista declarada no reclame un dígito.
  const declarados = codepointsDeclarados();
  const digitos = '0123456789'.split('').filter((d) => declarados.has(d.charCodeAt(0)));
  expect(digitos, 'EMOJI_DEL_MAPA no puede incluir dígitos: volvería a arrastrar la fuente entera').
    toEqual([]);
  expect([...declarados].every((p) => p > 0x2000), 'todo codepoint declarado debe ser un símbolo').
    toBe(true);
});
