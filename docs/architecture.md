# Arquitectura — TransferCuba

## Visión general

TransferCuba es una single-page app de mapa estilo Google Maps, construida con
Next.js 15 (App Router). Todo el estado vive en el componente cliente
`app/page.tsx`, que actúa como orchestrador, y se comunica con servicios
externos gratuitos (Nominatim, OSRM) directamente desde el navegador o a través
del API route.

```
┌─────────────────────────────────────────────────────────────┐
│                     Navegador (client)                      │
│                                                             │
│  app/page.tsx  (orchestrador: estado global + handlers)     │
│   ├── GoogleMapsTopBar          (búsqueda + filtros chips)  │
│   ├── MapLibreMap               (mapa + marcadores)         │
│   │     └── dynamic import, ssr:false                       │
│   ├── GoogleMapsDesktopPanel / MobileBottomSheet (listas)   │
│   ├── Modales: Filters, Register, Location, Admin           │
│   └── RouteInfoBar              (ruta OSRM activa)          │
└──────────────┬──────────────────────────────┬───────────────┘
               │ fetch                        │ fetch
               ▼                              ▼
   /api/businesses (Next.js route)   Servicios públicos OSM
   store in-memory + Haversine       ├── Nominatim (geocode)
                                    └── OSRM (rutas driving)
```

## Decisiones clave

### 1. Estado centralizado en `page.tsx`
Un solo árbol de estado (React `useState`/`useMemo`) contiene filtros, negocios,
selección, GPS, rutas y modales. Los componentes hijos reciben datos y callbacks
vía props — sin librería de estado global (Redux/Zustand) por ahora, suficiente
para el tamaño actual.

### 2. Mapa cargado con `dynamic(..., { ssr: false })`
MapLibre GL JS requiere `window`; se importa dinámicamente y se envuelve en
`MapErrorBoundary` para degradar con gracia si WebGL falla.

### 3. Persistencia localStorage (por ahora)
- Clave: `transfercuba_businesses_v2` — array `Business[]` serializado.
- El API route mantiene su propio store in-memory inicializado con el seed de
  `lib/cuba-data.ts` (se pierde al reiniciar el server).

### 4. Filtrado simulando PostGIS
El cliente y el API calculan distancia con Haversine
(`calculateDistanceMeters` en `lib/cuba-data.ts`), replicando lo que en
producción serían consultas `ST_DWithin`/`ST_Distance` sobre PostGIS.

## Flujo de datos principal

### Búsqueda y filtrado (client-side)
1. `GoogleMapsTopBar` / `GoogleMapsFiltersModal` actualizan los estados de
   filtro en `page.tsx`.
2. `filteredBusinesses` (memo) aplica: status `active` → provincia → municipio →
   categoría → transfer → activo ahora → QR/online → verificación → texto.
3. Orden: por distancia a `userLocation` (si existe) o `featured`+`rating`.

### Búsqueda con geocoding (Sprint 8)
El buscador de la TopBar muestra un dropdown con dos secciones:
- **Negocios**: primeras 3 sugerencias de `filteredBusinesses` (filtrado en
  cliente, se actualiza al teclear). Click → `handleSelectSearchBusiness` →
  vuela al negocio + abre el panel.
- **Lugares**: resultados de Nominatim (`lib/nominatim.ts`). El estado vive en
  `page.tsx`: `geocodePlaces`, `isGeocoding`, `searchFocused`, con `useEffect`
  sobre `searchQuery`.

Flujo del geocoding:
1. Debounce de 350 ms al teclear (0 ms si la query baja de 3 letras, para
   limpiar el dropdown al instante).
2. `searchNominatimAddressRateLimited(query, province)` (Sprint 8) envuelve la
   llamada con **throttle de 1 req/s real** (intervalo mínimo de 1100 ms medido
   al completarse cada request) por política de uso de Nominatim; el `User-Agent`
   se identifica como TransferCuba.
3. Token `geocodeTokenRef` descarta respuestas obsoletas (race conditions al
   teclear rápido). Máximo 5 lugares mostrados; contexto `, {provincia}, Cuba`.
4. Click en un lugar → `handleSelectPlace`: `flyTo` (nuevo centro/zoom 15),
   `searchQuery` se rellena con el nombre corto (primeros 2 segmentos de
   `display_name`) y se cierra el dropdown.
5. El dropdown se muestra solo con `searchFocused`; se cierra con Esc, blur o
   al seleccionar.

### Ruta OSRM
1. `handleCalculateRoute(business)` toma `userLocation` (o fallback Vedado).
2. `calculateOSRMRoute()` (`lib/osrm.ts`) llama al demo server público de OSRM.
3. La geometría GeoJSON se pasa a `MapLibreMap` como `routeGeometry` (source
   LineString) y `RouteInfoBar` muestra distancia/duración.

### Geocodificación Nominatim
Dos consumidores:
- `RegisterBusinessModal` usa `searchNominatimAddress()` para autocompletar
  direcciones cubanas y `reverseNominatimCoords()` para inferir dirección desde
  el pin.
- El dropdown de búsqueda de la TopBar usa `searchNominatimAddressRateLimited()`
  (mismo endpoint con `countrycodes=cu` y header `User-Agent` identificándose,
  pero garantizando ≤1 req/s real).

Ambos buscan solo dentro de Cuba.

## Estrategia de renderizado

| Ruta | Tipo | Nota |
|---|---|---|
| `/` | Static (client component) | Toda la interactividad es client-side |
| `/api/businesses` | Dynamic | GET/POST/PATCH, store in-memory |

## Futuro: PostGIS

El diseño está listo para migrar la capa de datos:

1. Reemplazar `INITIAL_BUSINESSES` por tabla `businesses` en PostgreSQL con
   columna `geography(Point, 4326)`.
2. El GET del API pasa de Haversine a:
   ```sql
   SELECT *, ST_Distance(geom, ST_MakePoint($lng,$lat)::geography)
   FROM businesses
   WHERE ST_DWithin(geom, ST_MakePoint($lng,$lat)::geography, $radius);
   ```
3. Sincronizar `localStorage` → server (hoy son dos stores independientes;
   `page.tsx` aún no consume el API route).

## Errores conocidos / deuda técnica

- **Doble store:** el frontend usa localStorage y el API su memoria; el
  registro de un negocio no llama a `POST /api/businesses`.
- **Sin auth en el panel admin:** `AdminDashboardModal` es accesible por
  cualquier usuario.
- **CSS MapLibre por CDN** en `layout.tsx` en lugar de importarlo del paquete.
- **Fuentes por `<link>`** con warning de ESLint (`no-page-custom-font`); lo
  idiomático sería `next/font`.
