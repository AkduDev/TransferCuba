# TransferCuba Map Engine V2 — Roadmap

> Respuesta a la inquietud central: *"infraestructura gratuita ilimitada no
> existe"*. Este plan asume límites reales en cada free-tier, y construye para
> migrar sin rehacer la app cuando el tráfico crezca.

## 0. Estado actual (base ya resuelta)

| Componente | Estado | Nota |
|---|---|---|
| MapLibre GL JS v6 | ✅ hecho | GPU rendering, `dynamic(ssr:false)` |
| Tiles vectoriales | ✅ hecho | OpenFreeMap Positron (free SIN límite, MIT) |
| Marker reconciliation | ✅ hecho | `Map<id,Marker>` con diffs |
| `fadeDuration:0`, cache tiles | ✅ hecho | Optimización render lista |
| OSRM routing | ✅ funciona | Demo server público; no prioridad |
| Nominatim geocoding | ⚠️ funciona | 1 req/s máximo — solo al registrar |
| Persistencia | ❌ localStorage | INITIAL_BUSINESSES en bundle — a eliminar |
| Viewport queries | ❌ no existe | El cliente recibe TODOS los negocios |

## 1. Matriz de límites reales (free tier)

| Servicio | Límite free | Estrategia |
|---|---|---|
| OpenFreeMap tiles | **Ilimitado** (donaciones) | Uso directo — sin riesgo |
| Vercel Hobby | 100 GB bandwidth/mes, serverless 10 s/req | Cache HTTP agresivo; PMTiles por CDN aparte si crece |
| Neon Postgres free | 0.5 GB storage, ~190 h compute/mes | Suficiente para ~100k negocios + índices |
| tile.openstreetmap.org | Uso justo (bulk policy) — NO es CDN | Solo fallback; ya no lo usamos |
| Nominatim público | 1 req/s absoluto | Solo geocodificar AL REGISTRAR (nunca leer) |
| OSRM demo público | Sin SLA, sin garantía | Aceptable para MVP; self-host futuro |
| Unsplash/Picsum | Fotos externas por negocio | Sprint 5: eliminar del flujo crítico |

**Regla de oro:** geocoding es *write-time*, nunca *read-time*. Una dirección
se geocodifica UNA vez al registrarse; el `lat/lng` vive en PostGIS.

## 2. Arquitectura objetivo

```
TRANSFERCUBA
     │
     ├───────────── Next.js (Vercel) ─────────────┐
     │                                            │
     │  app/page.tsx (orchestrator)               │
     │    └─ MapLibreMap V2 (GeoJSON + cluster)   │
     │         └─ viewport: moveend → debounce → bbox
     │                                            │
     │  app/api/businesses (route handlers)       │
     │    ├─ GET ?bbox= → PostGIS viewport query  │
     │    ├─ GET /nearby?lat&lng → ST_Distance    │
     │    ├─ POST (registro + Nominatim 1 vez)    │
     │    └─ PATCH (votos/aprobación)              │
     │                                            │
     ▼                                            ▼
PostgreSQL (Neon free)                        PMTiles Cuba
  + PostGIS ext                                (basemap propio)
  + GIST index (geom geography(Point,4326))    en CDN/Storage
  + indexes: (status), (province, municipality), (category)
```

**Clave de escalado:** con 100k negocios, una vista de La Habana devuelve
~300. El navegador nunca recibe el dataset completo; la pregunta pasa de
"¿puede MapLibre pintar 100k?" a "¿puede PostGIS responder los 300 visibles
en <50 ms?" — trivial con índice GIST.

Progreso: Sprints 1-5 ✅

## 3. Sprints

### Sprint 1 — Map Engine V2 (render) ✅ EN CURSO
Reemplaza DOM markers por capas nativas de MapLibre:

1. **GeoJSON source** con todos los negocios activos → una sola capa
2. **Supercluster via MapLibre** (`cluster: true`) — clustering gratis
3. **Iconos generados en runtime** (canvas → `addImage`): emoji de categoría
   + color de estado (verificado/pendiente/reportado) + pin seleccionado navy
4. **feature-state** para selección/hover — cero recreación de nodos
5. Click cluster → zoom/flyTo expansión; click punto → onSelectBusiness
6. `onViewportChange` (debounced moveend) expuesto como prop → prepara Sprint 3
7. Popup HTML mínimo en hover con nombre (opcional, solo desktop)

*Por qué primero: es el archivo donde más rendimiento se pierde hoy. Con
1k+ negocios los DOM markers saturan el main thread; las capas nativas
renderizan en GPU.*

### Sprint 2 — PostGIS (datos reales)
1. Neon project (free) + extensión `postgis`
2. Esquema:

```sql
CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  province TEXT NOT NULL,
  municipality TEXT NOT NULL,
  neighborhood TEXT,
  address TEXT NOT NULL,
  whatsapp TEXT,
  phone TEXT,
  hours TEXT,
  description TEXT,
  transfer_details JSONB NOT NULL,
  transfer_active_now BOOLEAN DEFAULT false,
  transfer_verified BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmations_count INT DEFAULT 0,
  reports_count INT DEFAULT 0,
  rating NUMERIC(2,1) DEFAULT 5.0,
  reviews_count INT DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
SELECT AddColumnGeography... -- geom geography(Point,4326)
CREATE INDEX ON businesses USING GIST (geom);
CREATE INDEX ON businesses (status, province, municipality);
CREATE INDEX ON businesses (status, category);
```

3. Migración de `INITIAL_BUSINESSES` → seed.sql (fuera del bundle JS)
4. API routes → consultas SQL (sin ORM pesado; `pg` directo o Drizzle)
5. Votos/aprobaciones → UPDATE con `updated_at` (auditable)
6. Eliminar localStorage como fuente; queda solo como cache offline

### Sprint 3 — Viewport queries
1. `MapLibreMap` emite `onViewportChange(bbox, zoom)` (debounce 250 ms)
2. `page.tsx` pide `GET /api/businesses?bbox=w,s,e,n&limit=500`
3. PostGIS:

```sql
SELECT *, ST_Distance(geom, ST_MakePoint($2,$1)::geography) AS distance_meters
FROM businesses
WHERE status = 'active'
  AND geom && ST_MakeEnvelope($3,$4,$5,$6)  -- bbox intersect
ORDER BY distance_meters
LIMIT 500;
```

4. GeoJSON source se actualiza con `setData()` (barato, no recrea)
5. Filtrados provincia/categoría server-side
6. HTTP cache: `s-maxage=60, stale-while-revalidate=300` en Vercel edge

### Sprint 4 — PMTiles de Cuba (basemap propio) ✅ HECHO
Soberanía total del basemap: sin depender de OpenFreeMap en runtime.

```
OSM extract → Geofabrik cuba-latest.osm.pbf (60 MB)
  → planetiler v0.10.2 generate-openmaptiles --area=cuba --max-zoom=14
    (requiere Java 21 — class file 65.0 — y datasets water/natural_earth)
  → cuba.pmtiles (85 MB, 43k tiles, 16 layers con datos en Cuba)
  → public/map/cuba.pmtiles (mismo origen; Vercel soporta HTTP Range)
  → pmtiles protocol en MapLibre (addProtocol)
  → public/map/style.json = Positron local con URL inyectada en runtime
```

Pasos de regeneración (documentado tras build en `pmtiles-build/`):

```bash
# 1. Descargar planetiler v0.10.2 (GitHub release; Java 21 obligatorio)
curl -L -o planetiler.jar \
  https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar

# 2. Obtener extract de Cuba (Geofabrik)
#    cuba-latest.osm.pbf

# 3. Generar (los datasets water/natural_earth se auto-descorgan con --download=true;
#    si quedan corruptos: borrar data/sources/*.zip y reintentar con resume `curl -C -`)
java -Xmx10g -jar planetiler.jar generate-openmaptiles \
  --osm-path=cuba-latest.osm.pbf --output=cuba.pmtiles \
  --max-zoom=14 --download=true --force

# 4. Copiar a public/ y validar
cp cuba.pmtiles <repo>/public/map/
./pmtiles show cuba.pmtiles   # bounds Cuba, tile type mvt, 0..14
```

- Cuba-only: 85 MB vs 1.5 TB del planeta — egress irrelevante
- Estilo Positron _fork_ en `public/map/style.json`: glyphs/sprites siguen en
  OpenFreeMap (gratis, cacheables); layers sin datos en el extract no fallan
- Zero dependencia de terceros para el basemap en runtime
- Fallback: si `style.json` o el pmtiles no están, cae a OpenFreeMap Positron
- Escalado futuro sin reescribir el mapa: `NEXT_PUBLIC_PMTILES_URL` apunta a
  R2/Backblaze (un solo swap de URL)

### Sprint 5 — Optimización Cuba-first (conectividad como restricción) ✅
Orden de carga (progressive enhancement):
1. HTML/CSS/UI shell (instantáneo, sin JS)
2. MapLibre chunk (dinámico)
3. Negocios GeoJSON (viewport)
4. Fotos: **solo al abrir ficha** — `loading="lazy"`, WebP (next/image nativo) ✅ · blur placeholder pendiente
5. Service worker (Workbox): precache assets estáticos + SWR datos/API + offline fallback; **tiles NO cacheados** (89 MB → rango 206 incompatible con Cache.put; basemap degrada a gris offline; decisionado para preservar bandwidth Vercel free)
6. Quitar fotos seed externas del bundle → placeholder local SVG por categoría

### Sprint 6 — Basemap estilo Google Maps ✅
Reemplaza el Positron gris por un estilo propio con la estética Google Maps:
agua azul, parques verdes, motorways clásicos ámbar/gold, roads blancas con
jerarquía de casing, buildings en zoom 15+ (opacidad progresiva), labels
jerarquizados (país → estado → ciudad → pueblo → villa) y boundaries con
dash para estados.

1. **`scripts/gen-style.mjs`** — generador Node del estilo (~53 layers) que
   escribe `public/map/transfercuba-style.json` (54 KB). Si se toca la paleta,
   se edita `C` y se re-ejecuta `node scripts/gen-style.mjs`.
2. **`public/map/transfercuba-style.json`** — estilo propio; usa la misma
   source `openmaptiles` (pmtiles://`__PMTILES_URL__`), glyphs/sprite sin
   cambiar (OpenFreeMap). Los iconos `circle_11_black`/`airport_11` salen del
   sprite `ofm_f384`.
3. **`components/MapLibreMap.tsx`** — cascade: `/map/transfercuba-style.json`
   → `/map/style.json` (Positron local) → OpenFreeMap CDN. El placeholder
   `__PMTILES_URL__` se inyecta igual que antes.
4. Verificado headless (Playwright): sky `#f0ede8`, agua `#a3d1f2` (17% en
   vistas amplias de la bahía), roads `#ffffff` con casings, residential
   `#edebe5` sobre bloques en z15, sin errores críticos en consola (solo 3
   range de glyphs >128k que OpenFreeMap no tiene — benignos).

### Sprint 7 — UX Google Maps: controles de mapa ✅
Controles flotantes al nivel de Google Maps (la búsqueda y el panel ya existían
desde sprints anteriores):

1. **Zoom custom** (`GoogleMapsFloatingControls`): píldora vertical `+/−`
   Google-style (blanca, hairline divider). Reemplaza al `NavigationControl`
   de MapLibre. `MapLibreMap` expone la instancia vía `mapRef` prop y avisa
   con `onMapReady` (evento `load`); los botones quedan deshabilitados hasta
   que `page.tsx` marca `mapReady`.
2. **Fullscreen**: botón circular con `Maximize/Minimize`; estado síncrono via
   `fullscreenchange` (Esc incluido) en `page.tsx`. Error → toast.
3. **GPS mejorado** (`handleUseCurrentGps`): si ya hay ubicación conocida,
   re-centra al instante y refresca precisión en segundo plano; distingue
   error de permiso vs timeout/señal en el toast; si el login previo existía,
   no degrada al fallback Vedado.
4. Verificado headless (Playwright): zoom cambia el render; fullscreen ON/OFF
   con label que cambia; GPS con geolocation override → toast de éxito; sin
   errores de consola (solo benignos: glyph ranges >127k de emojis que
   OpenFreeMap no sirve, se renderizan localmente).

### Sprint 8 — Búsqueda con geocoding (Nominatim) ✅
El buscador de la TopBar ahora vuela a direcciones reales de Cuba, mezclado
con sugerencias de negocios:

1. **Dropdown doble**: sección *Negocios* (3 primeras coincidencias de
   `filteredBusinesses`) + sección *Lugares* (5 resultados de Nominatim).
   Aparece al enfocar el input, se cierra con Esc/blur/selección.
2. **Debounce + throttle**: 350 ms de espera al teclear y límite real de
   1 req/s con `searchNominatimAddressRateLimited` (intervalo mínimo de
   1100 ms medido al completarse cada request), cumpliendo la política de
   Nominatim. `geocodeTokenRef` descarta respuestas fuera de orden.
3. **Selección de lugar** → `handleSelectPlace`: `flyTo` al punto (zoom 15),
   rellena el input con el nombre corto (`Ciudad, Provincia`) y cierra el
   dropdown. Selección de negocio → vuela + abre el panel como siempre.
4. Estados: `geocodePlaces`, `isGeocoding`, `searchFocused` en `page.tsx`;
   el componente `GoogleMapsTopBar` solo renderiza.
5. Verificado headless (Playwright): sugerencia de negocio clickeada →
   panel + input rellenado; geocoding muestra spinner → 3 lugares; click en
   "Plaza de la Revolución" → `flyTo` (cambio del 33.8% de píxeles) + input
   "Plaza de la Revolución, La Habana" + dropdown cerrado; 0 errores JS.
6. Documentado en `docs/architecture.md` (flujo de geocoding).

### Sprint 9 — Marcadores más ricos y clusterización ✅
Pins y clusters al nivel de Google Maps, con la señal de "transferencia viva"
como protagonista visual:

1. **Emojis centralizados**: `CATEGORY_EMOJI` en `lib/cuba-data.ts` como única
   fuente de verdad (arregla bug histórico: los pins dibujaban el texto
   `ShoppingBag`/`Pill` de `categoryIcon` lucide). `GoogleMapsTopBar` y el mapa
   consumen el mismo map.
2. **Clusterización nativa**: source GeoJSON `cluster:true`
   (`clusterRadius:55`, `clusterMaxZoom:14`) con `clusterProperties.active`
   (suma de `activeNow`). Capa única `clusters-layer` con color data-driven:
   esmeralda si algún negocio del grupo está activo, navy si no — el usuario
   ve "dónde hay transferencia viva" sin hacer zoom.
3. **Pin seleccionado + halo**: `unclustered-selected-layer` (icono sel a
   1.18×, `icon-allow-overlap`) + `selected-business-halo` (círculo esmeralda
   difuminado bajo el pin). El id seleccionado viaja como property `selected`
   del GeoJSON y el refresh es un `setData()` barato.
4. **Tarjeta de cluster**: click en cluster → `getClusterLeaves(8)` →
   `onClusterClick({businesses, center})` → `page.tsx` muestra overlay con
   filas (emoji + badge "● Activo" pulsante + barrio · categoría), botón
   "Ver mapa" (easeTo z15) y cierre. Fallback: `getClusterExpansionZoom` si
   el cluster no tiene negocios indexados.
5. **Robustez del setup** (lección de este sprint): el armado de capas es
   **idempotente** (`ensureLayer` re-añade lo que falte), se dispara tanto
   desde el effect de negocios como desde el evento `load` del mapa, y
   reintenta hasta 3× (900 ms) hasta que source + 5 capas estén montadas —
   porque `style.load` y la creación async del mapa generan carreres.
6. **Limitación documentada**: el runtime MapLibre de este proyecto **descarta
   silenciosamente** capas con expresiones `feature-state` (no lanza error,
   la capa no aparece en el style). Por eso la selección NO usa
   feature-state: `selected` es una property del GeoJSON y las capas
   filtran por ella.
7. Verificado headless (Playwright): 5 capas presentes tras carga; a z10
   cluster de 6 (6 activos → esmeralda); click → tarjeta con filas reales;
   click en fila → tarjeta se cierra, panel abre, capa sel + halo renderizan
   el negocio correcto con su icono; 0 errores JS; `bun run build` OK.

### Sprint 10 — Persistencia real (PostGIS/Neon) 🔜
Ejecuta el Sprint 2-3 del plan: migrar `INITIAL_BUSINESSES` a Postgres
(Neon free, extensión PostGIS, índice GIST), API routes sobre SQL con
filtrado server-side, queries por viewport (bbox) y eliminación del
doble store localStorage/memoria.

## 4. Lo que NO haremos ahora (y por qué)

- **Redis** — Postgres + HTTP cache cubre el volumen actual
- **Elasticsearch** — búsqueda trigram de Postgres (`pg_trgm`) basta
- **GraphQL** — REST routes ya modelan el dominio
- **Self-host OSRM** — hasta que el demo público sea cuello de botella
- **Kafka/queues** — votos son UPDATE simples

Cuando un componente sea cuello real de botella, se migra ese componente. La
arquitectura de arriba está diseñada para que cada pieza sea reemplazable.

## 5. Criterios de éxito

| Métrica | Objetivo |
|---|---|
| First paint (UI sin mapa) | < 1 s en 3G |
| Mapa interactivo | < 3 s en 3G |
| Viewport query PostGIS | < 50 ms p95 |
| Negocios por respuesta | ≤ 500 (paginado por cluster) |
| Requests a Nominatim | Solo en registro (~1/día proyectado) |
| Costo mensual | $0 hasta ~10k negocios / ~100k vistas |

## 6. Decisiones registradas (ADR mínimos)

1. **Sin ORM pesado** — `pg`/Drizzle directo; SQL espacial es el core
2. **Geography (no geometry)** — metros reales para ST_DWithin/ST_Distance
3. **GeoJSON + clustering nativo** antes que markers DOM — GPU vs main thread
4. **PMTiles solo en Sprint 4** — OpenFreeMap es ilimitado hoy; no optimizar
   antes de tiempo
5. **Votos idempotentes** vía `updated_at` + clave única por (user, business)
   cuando haya auth — hoy cuenta local
6. **Selección sin feature-state** (Sprint 9) — el runtime MapLibre del
   proyecto descarta capas con expresiones `feature-state` sin error visible;
   `selected` viaja como property del GeoJSON y el refresh es `setData()`

## 7. Tareas pendientes (backlog)

### Sprint 10 — Persistencia real PostGIS/Neon (siguiente)
- [ ] Proyecto Neon free + extensión `postgis`
- [ ] Esquema `businesses` + `geom geography(Point,4326)` + índice GIST
- [ ] Migrar `INITIAL_BUSINESSES` → `seed.sql` (fuera del bundle JS)
- [ ] API routes sobre SQL (`pg` directo); GET acepta `bbox` (viewport queries)
- [ ] Unificar stores: eliminar doble fuente localStorage/memoria
- [ ] `page.tsx` consume `GET /api/businesses` (hoy solo localStorage)
- [ ] Registro → `POST /api/businesses` real (hoy no llama al API)
- [ ] HTTP cache edge: `s-maxage=60, stale-while-revalidate=300`

### Deuda técnica vista en Sprint 9 (ordenada por prioridad)
- [ ] **DB caída en dev**: `queryBusinesses` en `lib/db.ts` lanza
      `ECONNRESET` y cae siempre al store in-memory (el pool de Neon muere
      tras idle). Verificar connectionString/reconnect antes de Sprint 10.
- [ ] **Auth en panel admin**: `AdminDashboardModal` accesible sin login.
- [ ] **Glyphs emoji 404**: OpenFreeMap no sirve rangos >127k (emojis del
      popup hover); se renderizan localmente con warning. Opción: sprite
      propio o quitar emoji del popup.
- [ ] **CSS MapLibre por CDN** en `layout.tsx` → importarlo del paquete.
- [ ] **Fuentes por `<link>`** → `next/font` (elimina warning ESLint).
- [ ] **`bun run build` lento en local** (>10 min con el dev server muerto);
      compilar en CI o investigar watcher colgado.
- [ ] Fotos seed externas (Picsum/Unsplash) fuera del bundle → SVG local por
      categoría (resto del Sprint 5).
- [ ] Self-host OSRM cuando el demo público sea cuello de botella.

### Mejoras de mapa (post-10)
- [ ] Hover en clusters (cursor + outline) igual que pins
- [ ] Animación de "expansión" al abrir cluster (hoy easeTo directo)
- [ ] Tarjeta de cluster: paginar >8 negocios con "Ver más"
- [ ] Reproducir el bug MapLibre `feature-state` en issue upstream (bundle
      `public/map/maplibre-gl-shared.mjs`) y valorar upgrade del runtime
