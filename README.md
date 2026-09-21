# TransferCuba — ¿Dónde Pago? Cuba

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)](https://tailwindcss.com)
[![MapLibre GL JS](https://img.shields.io/badge/MapLibre_GL_JS-6-green)](https://maplibre.org)
[![License](https://img.shields.io/badge/type-private-orange)]()

**El mapa y directorio de negocios que aceptan transferencias en Cuba** (Transfermóvil, Enzona, QR). Encuentra dónde pagar sin efectivo, con verificación comunitaria en tiempo real.

## ✨ Funcionalidades

- **🗺️ Mapa fullscreen** — MapLibre GL JS + tiles vectoriales OpenFreeMap (OSM) — gratis, ilimitado, sin API keys, nitidez GPU en cualquier zoom
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
| Mapa | MapLibre GL JS v6 + tiles vectoriales OpenFreeMap (Positron) |
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
    ├── businesses/
    │   └── route.ts       # API REST: GET / POST / PATCH de negocios
    ├── deliveries/
    │   ├── route.ts        # GET historial / POST crear carrera
    │   ├── available/
    │   │   └── route.ts    # GET carreras PENDING (mensajero)
    │   ├── estimate/
    │   │   └── route.ts    # GET estimación de tarifa
    │   └── [id]/
    │       ├── route.ts    # GET detalle / PATCH lifecycle
    │       └── reviews/
    │           └── route.ts  # GET/POST valoraciones (Fase 6)
    ├── messenger/
    │   ├── apply/
    │   │   └── route.ts    # GET/POST solicitud de mensajero
    │   └── platform/
    │       └── route.ts    # re-export config plataforma
    ├── admin/
    │   ├── platform/
    │   │   └── route.ts    # GET/PATCH config plataforma
    │   └── messengers/
    │       ├── route.ts    # GET listar solicitudes
    │       ├── [userId]/
    │       │   └── route.ts  # PATCH confirmar/rechazar/suspender
    │       └── pending/
    │           └── route.ts  # re-export solicitudes pendientes
    ├── auth/
    │   └── ...             # login / logout
    └── account/
        └── ...             # registro / sesión
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
├── AdminDashboardModal.tsx     # Dashboard de administración (incluye tab Mensajeros)
├── GoogleMapsMessengerModal.tsx # Modal de mensajería (solicitud, tablón, renovación)
├── GoogleMapsDeliveryModal.tsx  # Modal de delivery (crear carrera, tracking)
├── MessengerAdminPanel.tsx     # Panel admin para revisar solicitudes de mensajeros
└── RouteInfoBar.tsx            # Pill superior con info de ruta activa
lib/
├── cuba-data.ts            # Modelo Business, provincias/municipios, seed, Haversine
├── nominatim.ts            # Cliente Nominatim (geocode + reverse)
├── osrm.ts                 # Cliente OSRM (rutas de conducción)
├── db-delivery.ts          # DAO de delivery y mensajería (PostgreSQL)
├── delivery-client.ts      # Tipos DTO del cliente para delivery
├── delivery-dto.ts         # Mapeo server→DTO con privacidad por rol
├── pricing.ts              # Cálculo de tarifas por distancia
├── hooks/
│   ├── useDeliveries.ts    # Estado de delivery (polling + SSE futuro)
│   └── useMessengerApplication.ts  # Flujo de solicitud de mensajero
└── utils.ts                # Utilidades (cn)
docs/
├── architecture.md         # Arquitectura y flujo de datos
├── api.md                  # Referencia de la API REST
├── data-model.md           # Modelo de datos y ciclo de vida
├── messaging-module.md     # Módulo de mensajería (estado y decisiones)
db/
├── create_admin_user.sql   # Script para crear usuario admin (phone 5350000000, PIN admin123)
```

## 📖 Documentación

- [Arquitectura](docs/architecture.md) — cómo está construida la app y flujo de datos
- [API REST](docs/api.md) — endpoints, parámetros y ejemplos
- [Modelo de datos](docs/data-model.md) — tipos, provincias y ciclo de aprobación
- [Módulo de mensajería](docs/messaging-module.md) — delivery y mensajeros: estado, decisiones, fases

## 🔄 Ciclo de vida

### Negocio

```
Usuario registra negocio ──▶ status: pending (🟡 oculto del mapa)
        │
AdminDashboard ──▶ Aprobar ──▶ status: active (🟢 visible + verificado)
        │                └──▶ Rechazar ──▶ status: rejected (🔴 oculto)
        │
Comunidad ──▶ Votos 👍 (confirmaciones) / 👎 (reportes)
          ──▶ Toggle "transferencia activa ahora"
```

### Delivery

```
Solicitante crea carrera ──▶ PENDING (🔔 toast, polling cada 12s)
        │
Mensajero acepta ──▶ ACCEPTED ──▶ PICKED_UP ──▶ IN_TRANSIT ──▶ DELIVERED
        │                                                         │
        └──▶ CANCELLED (solicitante antes de aceptar, admin任何时候)    Solicitante valora (1-5)
                                                                   ──▶ review en DB
```

### Mensajero (Fase 5)

```
Solicitante paga alta ──▶ PENDING ──▶ Admin confirma ──▶ ACTIVE + rol MESSENGER
                                       │
                                       └──▶ Rechazar ──▶ vuelve a USER
                                       
Renovación ──▶ PENDING (mientras trabaja) ──▶ Admin confirma ──▶ expires_at extendido
```

> **Persistencia:** Negocios en PostgreSQL/PostGIS via `lib/db.ts`.
> Delivery y mensajería en PostgreSQL via `lib/db-delivery.ts`.
> Caché offline del frontend en `localStorage` (`transfercuba_businesses_v2`).
> Ver [docs/architecture.md](docs/architecture.md).

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
