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

### Sprint 4 — PMTiles de Cuba (basemap propio)
Cuando queramos soberanía total del mapa (ya no depender de OpenFreeMap):

```
OSM planet/extract → Geofabrik cuba-latest.osm.pbf
  → planetiler generate (schema OpenMapTiles, --area=cuba)
  → cuba.pmtiles (~80-150 MB mundo→Cuba)
  → R2/Backblaze/Neon storage (R2 free: 10 GB, sin egress fee)
  → pmtiles protocol en MapLibre (addProtocol)
```

- Cuba-only: ~100 MB vs 1.5 TB del planeta — egress irrelevante
- Estilo Positron custom via Maputnik (colores del design system)
- Zero dependencia de terceros para el basemap

### Sprint 5 — Optimización Cuba-first (conectividad como restricción)
Orden de carga (progressive enhancement):
1. HTML/CSS/UI shell (instantáneo, sin JS)
2. MapLibre chunk (dinámico)
3. Negocios GeoJSON (viewport)
4. Fotos: **solo al abrir ficha** — `loading="lazy"`, WebP, blur placeholder
5. Service worker (Workbox) — cache offline de tiles y datos
6. Quitar fotos seed externas del bundle → placeholder local SVG por categoría

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
