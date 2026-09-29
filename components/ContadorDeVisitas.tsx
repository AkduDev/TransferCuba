'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Cuenta una apertura de página, una vez por sesión y ruta.
 *
 * Va sin `await` y tragándose el fallo: medir no puede estropearle la visita a
 * nadie. Y no manda nada más que la ruta — ni identificador, ni referente, ni
 * nada que permita reconstruir quién es quien.
 */
export default function ContadorDeVisitas() {
  const ruta = usePathname();

  useEffect(() => {
    if (!ruta) return;
    const clave = `tc_visita_${ruta}`;
    try {
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, '1');
    } catch {
      // Navegación privada o almacenamiento bloqueado: se cuenta igual.
    }
    void fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: ruta }),
      keepalive: true
    }).catch(() => undefined);
  }, [ruta]);

  return null;
}
