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

### Sprint 8 — Búsqueda con geocoding (Nominatim) 🔜
El buscador actual filtra negocios en cliente. Sprint 8 vuela a direcciones:
autocomplete con `/search` (Nominatim, 1 req/s con User-Agent), selección →
`flyTo`, y resultados de negocios mezclados con lugares.

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
