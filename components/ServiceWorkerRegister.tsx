'use client';

import { useEffect } from 'react';

// Sprint 5 — registra el service worker (Workbox) solo en producción.
// En dev HMR rompería el cache; aquí también se usa DEV para el test local.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // contexto inseguro, navegador sin soporte, etc. — offline es un extra
        });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}