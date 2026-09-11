import type {Metadata} from 'next';
import './globals.css'; // Global styles
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

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
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
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
