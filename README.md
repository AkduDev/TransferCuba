# TransferCuba — ¿Dónde Pago? Cuba

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)](https://tailwindcss.com)
[![MapLibre GL JS](https://img.shields.io/badge/MapLibre_GL_JS-6-green)](https://maplibre.org)
[![License](https://img.shields.io/badge/type-private-orange)]()

**El mapa y directorio de negocios que aceptan transferencias en Cuba** (Transfermóvil, Enzona, QR). Encuentra dónde pagar sin efectivo, con verificación comunitaria en tiempo real.

## ✨ Funcionalidades

- **🗺️ Mapa fullscreen** — MapLibre GL JS + tiles de OpenStreetMap/CartoDB (sin API keys)
- **📍 Directorio con filtros** — provincia, municipio, categoría, estado de verificación, canal de pago (QR / online)
- **🟢 Estado en vivo** — "acepta transferencia ahora" actualizable por la comunidad
- **🚗 Rutas OSRM** — traza la ruta de conducción desde tu ubicación GPS hasta el negocio, con distancia y tiempo
- **🔎 Geocodificación Nominatim** — búsqueda de direcciones cubanas y colocación de pines por coordenadas
- **🏪 Registro de negocios** — flujo de alta con pin interactivo en el mapa y asistente de direcciones
- **🛡️ Panel de administración** — aprobación, verificación, activación y eliminación de negocios
- **👍 Verificación comunitaria** — votos de confirmación y reportes por negocio
- **📱 Responsive** — bottom sheet en móvil, panel flotante en escritorio

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Lenguaje | TypeScript 5.9 |
| Estilos | Tailwind CSS 4 + tw-animate-css |
| Mapa | MapLibre GL JS + OpenStreetMap tiles |
| Geocoding | Nominatim (OSM) |
| Rutas | OSRM (router.project-osrm.org) |
| Iconos | lucide-react |
| Gestor | Bun |

## 🚀 Empezar

Requisitos: [Bun](https://bun.sh) >= 1.1 (o npm/pnpm/yarn con Node >= 20).

```bash
# Instalar dependencias
bun install

# Servidor de desarrollo en http://localhost:3000
bun run dev

# Build de producción
bun run build && bun run start
```

No se requieren variables de entorno ni API keys: todos los servicios de mapas
(Nominatim, OSRM, tiles OSM) son públicos y gratuitos. Ver `.env.example`.

## 📂 Estructura del proyecto

```
app/
├── layout.tsx              # Root layout: fuentes, CSS del mapa, metadata SEO
├── page.tsx               # Página principal (orchestrador de estado de la app)
├── globals.css            # Tailwind 4 + estilos globales (scrollbars, beacons)
└── api/
    └── businesses/
        └── route.ts       # API REST: GET / POST / PATCH de negocios
components/
├── MapLibreMap.tsx         # Mapa MapLibre GL JS (marcadores, pins, rutas)
├── MapErrorBoundary.tsx    # Error boundary del mapa
├── GoogleMapsTopBar.tsx    # Barra superior: búsqueda, categorías, chips de filtro
├── GoogleMapsDesktopPanel.tsx  # Panel lateral de resultados (desktop)
├── GoogleMapsMobileBottomSheet.tsx  # Bottom sheet de resultados (móvil)
├── GoogleMapsPlaceCard.tsx # Tarjeta de negocio reutilizable
├── GoogleMapsFloatingControls.tsx   # Controles flotantes (GPS, registrar, provincia)
├── GoogleMapsSideDrawer.tsx # Drawer lateral de navegación
├── GoogleMapsFiltersModal.tsx  # Modal de filtros avanzados
├── RegisterBusinessModal.tsx   # Modal de registro de negocio (pin + Nominatim)
├── LocationPickerModal.tsx    # Modal de selección de ubicación (GPS/presets)
├── AdminDashboardModal.tsx     # Dashboard de administración
└── RouteInfoBar.tsx            # Pill superior con info de ruta activa
lib/
├── cuba-data.ts            # Modelo Business, provincias/municipios, seed, Haversine
├── nominatim.ts            # Cliente Nominatim (geocode + reverse)
├── osrm.ts                 # Cliente OSRM (rutas de conducción)
└── utils.ts                # Utilidades (cn)
docs/
├── architecture.md         # Arquitectura y flujo de datos
├── api.md                  # Referencia de la API REST
└── data-model.md           # Modelo de datos y ciclo de vida de un negocio
```

## 📖 Documentación

- [Arquitectura](docs/architecture.md) — cómo está construida la app y flujo de datos
- [API REST](docs/api.md) — endpoints, parámetros y ejemplos
- [Modelo de datos](docs/data-model.md) — tipos, provincias y ciclo de aprobación

## 🔄 Ciclo de vida de un negocio

```
Usuario registra negocio ──▶ status: pending (🟡 oculto del mapa)
        │
AdminDashboard ──▶ Aprobar ──▶ status: active (🟢 visible + verificado)
        │                └──▶ Rechazar ──▶ status: rejected (🔴 oculto)
        │
Comunidad ──▶ Votos 👍 (confirmaciones) / 👎 (reportes)
          ──▶ Toggle "transferencia activa ahora"
```

> **Nota:** la persistencia actual es `localStorage` (frontend) + store in-memory
> (API route). El diseño está preparado para migrar a PostgreSQL/PostGIS
> (filtros `ST_DWithin`/`ST_DDistance` ya simulados). Ver
> [docs/architecture.md](docs/architecture.md#futuro-postgis).

## 📜 Scripts

| Comando | Descripción |
|---|---|
| `bun run dev` | Servidor de desarrollo |
| `bun run build` | Build de producción |
| `bun run start` | Servir build de producción |
| `bun run lint` | ESLint |

## ⚠️ Atribución

Los datos de mapa son © OpenStreetMap contributors. Geocoding por Nominatim y
routing por OSRM — respeta sus políticas de uso (máx. 1 req/s) si haces
despliegue en producción.
