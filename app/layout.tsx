import type {Metadata} from 'next';
import {Plus_Jakarta_Sans} from 'next/font/google';
import './globals.css'; // Global styles
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

// next/font: las fuentes se auto-alojan en build (sin dependencia de Google
// Fonts en runtime — clave para Cuba, donde los CDNs externos son lentos).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap'
});

export const metadata: Metadata = {
  title: '¿Dónde Pago? Cuba — TransferCuba | Negocios con Transferencia',
  description: 'TransferCuba: El mapa y directorio de negocios que aceptan transferencia en Cuba (MapLibre GL JS + OpenStreetMap + Nominatim + PostGIS).',
  openGraph: {
    title: '¿Dónde Pago? Cuba — TransferCuba | Negocios con Transferencia',
    description: 'TransferCuba: El mapa y directorio de negocios que aceptan transferencia en Cuba (MapLibre GL JS + OpenStreetMap + Nominatim + PostGIS).',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '¿Dónde Pago? Cuba — TransferCuba | Negocios con Transferencia',
    description: 'TransferCuba: El mapa y directorio de negocios que aceptan transferencia en Cuba.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es" className={jakarta.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@6.8.0/dist/maplibre-gl.css"
          crossOrigin=""
        />
      </head>
      <body suppressHydrationWarning className="bg-canvas text-text-primary antialiased selection:bg-cerulean selection:text-white font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
