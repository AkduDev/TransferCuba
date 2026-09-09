import type {Metadata} from 'next';
import './globals.css'; // Global styles

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
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
          crossOrigin=""
        />
      </head>
      <body suppressHydrationWarning className="bg-slate-900 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white font-sans">
        {children}
      </body>
    </html>
  );
}
