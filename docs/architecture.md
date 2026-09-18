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

### 5. Acceso a datos con circuit breaker (Sprint 10)
`lib/db.ts` escoge entre PostGIS (si `DATABASE_URL` está configurada) y un
fallback in-memory idéntico en forma de fila. Un **circuit breaker** evita
que una BD inalcanzable degrade el desarrollo:

1. `connectionTimeoutMillis: 5_000` acota cada intento (sin límite, una red
   que bloquee el TLS a 5432 dejaría la query colgada).
2. Al primer fallo se abre el circuito durante `DB_RETRY_MS` (60s) y se loguea
   una sola vez qué ocurrió.
3. Mientras está abierto, todas las operaciones (`queryBusinesses`,
   `insertBusiness`, `patchBusiness`, `queryBusinessesByIds`,
   `countBusinesses`) van directo al fallback in-memory en <100ms.
4. Al expirar el cooldown se reintenta la BD en silencio; si vuelve a
   funcionar, `markDbAvailable()` cierra el circuito.
5. `patchBusiness` ahora aplica la mutación al fallback in-memory si la BD
   falla (antes devolvía `null` y perdía la optimización local).

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

## Tipografía (next/font)

`app/layout.tsx` carga `Plus_Jakarta_Sans` con `next/font/google` y
`variable: '--font-jakarta'`. Las fuentes se auto-alojan en build
(`.next/static/media/*.woff2`) y el tema de `globals.css` apunta a esa
variable CSS (`--font-sans: var(--font-jakarta), ...`). Sin `<link>` de
Google Fonts ni preconnect: funciona offline y es rápido en Cuba (sin
CDNs externos). Eliminó el warning de ESLint `no-page-custom-font`.

## CSS de MapLibre (del paquete, no CDN)

El CSS de MapLibre se importa del paquete instalado
(`import 'maplibre-gl/dist/maplibre-gl.css'` en `layout.tsx`) en lugar del
`<link>` a unpkg.com. Se compila en los chunks CSS del build (self-hosted,
sin dependencia externa en runtime). El único `<style>` propio del dominio
relativo a MapLibre en `globals.css` es `.maplibregl-canvas { outline: none }`.

## Build lenta en local (disco NTFS) — diagnóstico cerrado

**Síntoma:** `bun run build` tarda ~8 min en este entorno (>10 min con
dev server vivo).

**Causa raíz (medida, no especulada):** el repo vive en un disco NTFS
montado vía `fuseblk` (ntfs-3g): escritura de **~11 MB/s** (dd 50 MB =
4,7 s). La build escribe cientos de MB — chunks de webpack, cache de
SWC y, con `output:'standalone'`, una copia trazada de `node_modules` —
así que es I/O-bound, no CPU-bound ni un watcher colgado. Medición de
build limpia completa: **484 s** (de los cuales 117 s es solo el compile
de webpack).

**Por qué no se puede fixear con distDir custom (experimento hecho y
revertido):**

1. Next trata `distDir` como relativo al directorio del proyecto: un
   path absoluto (`/home/...`) termina creándose DENTRO del repo
   (`<repo>/home/...`), verificado empíricamente en Next 15.5.25.
2. Un symlink `<repo>/.next-fast -> /home/Akdulay/.transfercuba-build`
   pasa la fase de compilación, pero el build worker hace `require`
   desde `_document.js` situado (por realpath) fuera del repo, y Node
   resuelve `node_modules` subiendo por el path REAL — no encuentra
   `react/jsx-runtime` y la build muere en "Collecting page data".

**Conclusiones operativas:**

- El pipeline queda como estaba (`distDir: '.next'` por defecto).
- En CI/Vercel el FS es nativo y compila a velocidad normal: las
  builds integrales de verdad delegarlas a CI.
- Para verificación local del día a día: `bunx tsc --noEmit` y
  `bunx eslint` (segundos) cubren types y lint; la build completa
  solo cuando toque.
- Fix real del entorno (fuera del alcance del código): mover el repo
  a un FS ext4 nativo.

## Glifos emoji auto-alojados (`font-faces`)

Los nombres de POIs de OSM traen emojis ("Plaza de la Paz 🕊️"). El
`glyphs` de OpenFreeMap solo sirve rangos <127k, así que cada emoji en un
label disparaba un 404 + warning y MapLibre rasterizaba con la fuente del
SO (no determinista). Fix con `font-faces` (style-spec de MapLibre ≥ 6.9):

- `public/map/fonts/emoji-{0..9}.woff2` — subsets de Noto Color Emoji de
  Google Fonts (~2 MB total), servidos del mismo origen.
- En `public/map/{transfercuba-}style.json`, cada stack de texto
  ("Noto Sans Regular"/Bold/Italic) declara los 10 archivos con sus
  `unicode-range` correspondientes. `FontFaceManager` descarga **solo el
  subset que cubre el codepoint que se va a dibujar** (carga lazy) y lo
  registra en `document.fonts`.
- Resultado: cero requests 404 a `tiles.openfreemap.org/fonts`, cero
  warnings "Unable to load glyph range", y rasterizado (TinySDF) siempre
  desde el woff2 local. Si un archivo falla, cae al siguiente y de ahí al
  `glyphs` URL (degradación suave, sin romper el mapa).
- Actualizar los subsets: re-descargar el CSS de
  `fonts.googleapis.com/css2?family=Noto+Color+Emoji` con UA de Chrome,
  guardar cada `url(...)` secuencialmente como `emoji-{i}.woff2` y
  regenerar el bloque `font-faces` con los `unicode-range` del CSS.

## Capas del mapa (Sprint 9)

`MapLibreMap` monta un source GeoJSON `businesses-source` (`cluster:true`,
`clusterRadius:55`, `clusterMaxZoom:14`, `clusterProperties.active`) y cinco
capas idempotentes (re-añadidas si faltan):

| Capa | Tipo | Filtro / nota |
|---|---|---|
| `clusters-layer` | circle | `point_count`; color data-driven: esmeralda si `active > 0` |
| `cluster-count-layer` | symbol | `point_count_abbreviated` en blanco |
| `unclustered-layer` | symbol | pins normales (`icon` property → id de imagen) |
| `unclustered-selected-layer` | symbol | `selected == true`; icono sel a 1.18× |
| `selected-business-halo` | circle | halo esmeralda difuminado bajo el pin sel |

- **Iconos runtime**: canvas → `addImage` (pixelRatio 2), id
  `pin-{categoryIcon}-{v|r|p|sel}-{on|off}`; la property `icon`/`iconSel` del
  GeoJSON referencia el id exacto (evita re-construir el string en el layout).
- **Selección**: el id seleccionado viaja como property `selected` del
  GeoJSON (`businessesToGeoJSON(businesses, selectedId)`); al cambiar la
  selección se relanza `setupLayers()` que hace `setData()` (barato).
- **Setup resiliente**: `setupLayers` se dispara desde el effect de
  negocios y desde el evento `load` del mapa, reintenta 3× hasta ver las 5
  capas, y registra interacción (click/cursor/popup) una sola vez por
  instancia (`mapInteractiveRef`).
- **Limitación runtime (verificada en 6.9.0)**: en versiones antiguas del
  bundle, las capas con expresiones `feature-state` se descartaban
  silenciosamente (sin throw). Con el bundle actual self-hosted
  (**maplibre-gl 6.9.0**) ya NO se descartan: la capa se añade, aparece en
  `getStyle().layers`, `getLayer()` la devuelve y renderiza tras
  `setFeatureState()`. Único residuo: warning benigno si se lee la `state`
  sin valor previo ("Expected value to be of type number, but found null.
  Falling back to 5") — se elimina con `['coalesce', ['feature-state', k],
  dflt]`. El proyecto sigue usando selección data-driven por properties
  (probado y eficiente); feature-state queda disponible si se quiere.
  Reproducción headless documentada en `docs/roadmap.md`.
- **Debug**: en dev, `window.__MAP__` expone la instancia (lo usan los tests
  de Playwright para proyectar coordenadas y clickear pins/clusters).

### Interacción con clusters (post-10, Sprint 10)
- **Hover halo**: `cluster-hover-source` (GeoJSON vacío) + `cluster-hover-halo`
  (circle con `circle-radius: ['get','r']`, COLOR_VERIFIED, blur 0.5,
  opacity 0.3, colocada bajo `clusters-layer` en el orden de capas).
  `mouseenter` en `clusters-layer` escribe un FeatureToPoint con radio
  dinámico `clusterRadius(count) + 5`; `mouseleave` vacía la source.
  Solo se pinta mientras el cursor está encima (verificado headless:
  haloOn=1, haloOff=0).
- **Click de cluster**: `getClusterLeaves(clusterId, Math.max(pointCount,8), 0)`
  trae todas las hojas (max 8 necesarios para desagrupar con clusterMaxZoom
  14, pero aquí pide todo el tamaño real para la paginación).
- **Paginación en tarjeta**: la tarjeta de cluster muestra las primeras 9 filas
  con un botón "Ver más negocios (N)" que expande al total y desaparece.
- **Expansión**: el click de cluster captura `expansionZoom` (el zoom necesario
  para desagrupar ese cluster concreto). "Ver mapa" cierra la tarjeta y hace
  `easeTo({zoom: expansionZoom, duration: 900})` en vez del zoom fijo 15
  anterior (verificado headless: z12.97 → z15, tarjeta cerrada).

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

## Fotos de negocio (Sprint 5 — sin CDNs externos)

Cuba-first: ninguna foto de negocio se carga desde un CDN externo
(Picsum/Unsplash/Pexels/Shutterstock); en Cuba esos dominios son lentos o
inaccesibles, y el placeholder local siempre es más rápido.

- **Fuente de verdad**: `businesses.photos` (`string[]`). El seed
  (`INITIAL_BUSINESSES` en `lib/cuba-data.ts`) usa `photos: []`.
- **Sanitización en 2 capas**: `lib/db.ts` (`sanitizePhotos`, al leer filas
  y al insertar) y `app/api/businesses/route.ts` (`POST` descarta CDNs
  externos y no inyecta fallback: sin fotos → `[]`). La regex
  `EXTERNAL_PHOTO_PATTERN` filtra `unsplash|picsum|pexels|shutterstock`.
- **Render**: `components/BusinessCover.tsx`. Con foto → `next/image`
  (`loading="lazy"`, `fill`, `referrerPolicy="no-referrer"`); sin foto →
  placeholder local por categoría (`getCategoryStyle` en
  `lib/category-style.tsx`), icono lucide + color de la categoría en ambos
  variants (`thumb` miniatura, `banner` con label de categoría).
- **Config**: `next.config.ts` ya no declara `remotePatterns` de
  imágenes externas; el único `<img>` de red que existía quedó eliminado.
  Si un negocio llega a subir fotos propias, se añadirá el host al que
  se sirvan (self-host o storage propio), nunca un CDN público.

## Auth del panel admin (Sprint 11)

- **Login contra el servidor, no el bundle.** `POST /api/auth/login` valida
  `username`/`password` contra `ADMIN_USERNAME`/`ADMIN_PASSWORD` del entorno
  con `crypto.timingSafeEqual` (constant-time). Las credenciales ya no viven
  en el JS del cliente.
- **Sesión en cookie HttpOnly**: firma HMAC-SHA256 con `ADMIN_TOKEN_SECRET`
  (si no existe, deriva del password), payload `{ exp }`, TTL 24 h, `SameSite=Lax`.
  El flag `tc_admin_session_auth` del frontend es solo caché de UX; la pieza
  que decide es el servidor.
- **Endpoints protegidos (401 sin sesión)**: `GET /api/businesses?includeAll=true`
  y `PATCH` con acciones `verify | approve | reject | toggleTransferActive | delete`.
  `vote`/`report` y `POST` (registro público, nace `pending`) no exigen sesión.
- **Estado de sesión**: `GET /api/auth/me` lo expone al frontend al abrir el
  modal; `POST /api/auth/logout` invalida la cookie. Sin variables en `.env`
  el login responde 503.

## Identidad de usuarios (Fase 0 — módulo mensajería)

- **Registro por teléfono + PIN**, sin email. PIN hasheado con `scrypt`
  (`node:crypto`, sal aleatoria); `normalizePhone` elimina espacios/guiones/`+`.
- **Dos auths separadas**: la admin del panel es `lib/admin-auth.ts`
  (cookie `tc_admin_session`, HMAC). La de usuarios es `lib/auth.ts` +
  `lib/db-auth.ts` (cookie HttpOnly `tc_session`, sesión persistida en la
  tabla `sessions`). Namespaces de API distintos: `/api/auth/*` vs
  `/api/account/*`.
- **Estado en el cliente**: `lib/hooks/useAuth.ts` hidrata con
  `GET /api/account/me`; la autoridad es la cookie, no el estado local.
  `components/GoogleMapsAuthModal.tsx` gestiona login/registro/perfil y lo
  abren `GoogleMapsTopBar` (botón "Cuenta") y `GoogleMapsSideDrawer`.
- **Sin BD → 503** (a propósito): no hay fallback in-memory para cuentas.
- **Mensajería/delivery**: plan completo en `docs/messaging-module.md`.

## Modales accesibles (`ModalShell`)

Los siete modales y el cajón lateral repetían el mismo `div` de capa (`fixed inset-0` + panel
blanco) copiado a mano, sin semántica de diálogo: ni `role`, ni `aria-modal`,
ni cierre con `Escape`, ni trampa de foco, ni clic en el fondo. El foco se
quedaba detrás, sobre el mapa, y quien navega con teclado no tenía salida.

`components/ModalShell.tsx` centraliza esa carcasa. Sin dependencias nuevas
(regla del proyecto): todo se resuelve con `node`-free DOM APIs y refs.

### Qué aporta

- `role="dialog"`, `aria-modal="true"` y `aria-labelledby` obligatorio: el
  diálogo se anuncia con su título en vez de leerse como un `div` suelto.
- Cierre con `Escape` y con clic en el fondo. El clic solo cuenta si el gesto
  **empieza y termina** sobre la capa, para no cerrar al arrastrar una
  selección desde dentro del panel hacia fuera.
- Trampa de foco cíclica con `Tab`/`Shift+Tab`, foco inicial en el panel
  (`tabIndex={-1}`) para que el lector anuncie el título, y devolución del
  foco al elemento que abrió el modal cuando se cierra.
- Bloqueo del scroll de `body` mientras haya algún modal abierto.

### Pila de modales

Dos modales pueden coexistir: el de mensajería y el de envíos abren el de
cuenta (`onOpenAuth`) **sin cerrarse**. Una pila a nivel de módulo resuelve
quién manda:

- Solo el diálogo del tope responde a `Escape`, atrapa el foco y acepta el
  clic en el fondo. Sin la pila, un `Escape` cerraría los dos a la vez
  (`stopPropagation` no detiene a otros listeners del mismo nodo en la misma
  fase; haría falta `stopImmediatePropagation`, que sería peor).
- El `overflow` original de `body` se guarda solo al pasar de 0 a 1 modal y se
  restaura al volver a 0. Guardarlo por instancia hacía que el segundo modal
  memorizara `hidden` y lo dejara puesto al cerrarse.

### Cómo se usa

```tsx
<ModalShell
  isOpen={isOpen}
  onClose={onClose}
  labelledBy="delivery-modal-title"       // id de un elemento real del árbol
  describedBy="delivery-modal-subtitle"   // opcional
  backdropClassName="bg-navy-deep/60 backdrop-blur-sm"  // opcional
  overlayClassName="z-[60] p-3 sm:p-5"    // z-index y padding de la capa
  panelClassName="bg-white rounded-xl ... max-w-lg max-h-[94dvh]"
>
  {/* cabecera + cuerpo del modal */}
</ModalShell>
```

`backdropClassName` está separado de `overlayClassName` a propósito: las clases
de Tailwind resuelven por orden en el CSS, no por orden en el atributo, así que
`RegisterBusinessModal` no podría sobrescribir el fondo por defecto pasando
`bg-navy-deep/60` en la misma cadena. El componente ya aporta
`flex flex-col overflow-hidden` al panel, así que no hay que repetirlos.

### Cajón lateral

`GoogleMapsSideDrawer` es el mismo patrón (scrim + panel) pero anclado a la
izquierda, así que `alignClassName` desacopla la colocación del panel:
`items-stretch justify-start` en vez del `items-center justify-center
overflow-y-auto` por defecto. Su `div` espaciador con `flex-1` y `onClick`
desaparece — el clic en el fondo ya lo gestiona la carcasa.

### Qué NO envuelve

La vista `pick` de `GoogleMapsDeliveryModal` (banner de "haz clic en el mapa")
**no** es un diálogo: es una capa `pointer-events-none` en z-40 cuyo propósito
es dejar pasar el clic al mapa. Envolverla bloquearía justo lo que tiene que
permitir. Por eso ese componente conserva su `if (!isOpen) return null` y su
rama temprana.

### Foco visible

El anillo de foco vive en `app/globals.css`, en `@layer base`, con `:where(...)`
para que la especificidad quede en 0 y cualquier componente pueda
sobrescribirlo. Usa `--color-cerulean`: 4,09:1 sobre blanco y 3,62:1 sobre
navy, por encima del 3:1 que WCAG 1.4.11 exige a un indicador de foco en las
dos superficies del proyecto.

### Pruebas end-to-end

`e2e/modal-accesibilidad.spec.ts` fija el contrato de la carcasa con Playwright
(`bun run test:e2e`). Se ejercita sobre el modal de filtros y el cajón lateral
porque son las dos únicas superficies que abren **sin sesión**; el resto exige
cuenta y dos de ellas además un rol concreto. Lo que se comprueba vive en la
carcasa compartida, así que cubre a los ocho consumidores:

- semántica (`role="dialog"`, `aria-modal`, nombre accesible vía `labelledBy`);
- el foco entra al abrir y vuelve al disparador al cerrar con `Escape`;
- 40 `Tab` y 40 `Shift+Tab` sin que el foco salga del diálogo;
- anillo de foco real: `solid 2px rgb(2, 132, 199)` sobre el elemento activo;
- clic en el fondo cierra, pero **arrastrar** desde dentro hasta el fondo no;
- `body` bloquea el scroll al abrir y lo restaura al cerrar;
- botón de cerrar ≥ 44×44 px;
- el cajón queda pegado al borde izquierdo y a toda la altura.

Dos decisiones de configuración que no son cosméticas:

1. **`outputDir` fuera del proyecto** (`os.tmpdir()`). Escribir `test-results/`
   dentro del árbol despierta al watcher de `next dev`, que recompila a mitad
   de la suite y deja navegaciones colgadas hasta agotar el timeout. Costó dos
   pruebas en rojo antes de localizarlo.
2. **`workers: 1`**. Con el disco NTFS a ~11 MB/s, varios workers contra un
   único `next dev` compiten por I/O; la ejecución en paralelo tardaba más
   (3,7 min con 2 workers y 2 fallos) que en serie (1,5 min en verde).

La suite corre contra `next dev`, no contra una build, por el mismo motivo de
I/O. Las peticiones que no son del mismo origen (teselas, glifos, OSRM,
Nominatim) se abortan desde el test para que sea hermética y no dependa de la
red cubana ni de terceros.

#### Fixture de cuenta de prueba

`e2e/fixtures/cuenta.ts` da de alta una cuenta y deja su sesión puesta en el
contexto del navegador. Lo usa `e2e/mensajeria.spec.ts`, que necesita rol
`MESSENGER` con perfil `ACTIVE` para llegar al tablón.

- **El alta va por `POST /api/account/register`**, no por SQL: así se ejercita
  el endpoint real y la cookie `tc_session` llega sola al navegador, porque
  `page.request` comparte almacenamiento con el contexto.
- **La promoción de rol y el borrado sí van por SQL**, porque no hay endpoint
  público para ninguna de las dos cosas. Para `MESSENGER` se inserta además el
  perfil en `ACTIVE`; por la vía normal haría falta pago y aprobación de
  administración.
- **Se borra sola**, pase o falle la prueba. El orden importa:
  `delivery_requests.requester_id` es `ON DELETE RESTRICT`, así que las carreras
  van antes que el usuario; `sessions`, `messengers_profiles` y
  `messengers_payments` caen por cascada.
- Los teléfonos llevan el prefijo `5550` para reconocer restos si alguna vez
  falla el teardown.

**Nunca escribe en la base de la aplicación.** Exige `E2E_DATABASE_URL`, y sin
ella el fichero entero se salta con un motivo explícito. Como el proyecto vive
en Neon, lo natural es una **rama** de `neondb` (`neonctl branches create`),
que nace con el esquema puesto y se tira al terminar:

```bash
E2E_DATABASE_URL='postgresql://…@ep-…/neondb?sslmode=require' bun run test:e2e
```

`playwright.config.ts` pasa ese valor como `DATABASE_URL` al `next dev` que
levanta; `@next/env` no pisa una variable que ya exista en `process.env`, así
que gana sobre `.env.local`.

Verificado end-to-end contra un PostGIS desechable: 18/18 en verde y la base
limpia después (`users=0 sessions=0 perfiles=0 carreras=0`).

Aviso al montar una base desde cero: `db/schema.sql` **no se aplica entero** en
PostgreSQL 16 limpio. El índice parcial de `business_promotions` (líneas
166-167) usa `NOW()` en el predicado y falla con *«functions in index predicate
must be marked IMMUTABLE»*. Todo lo anterior sí se crea, y las migraciones de
auth y delivery se aplican sin problema, así que no afecta a estas pruebas —
pero el fichero no es reproducible tal cual.

Una aserción tuvo que pasar a `expect.poll`: `transition-colors` de Tailwind
incluye `outline-color`, así que leer el anillo de foco una sola vez justo tras
el `Tab` cae a veces dentro de la transición de 150 ms y devuelve el
`currentColor` de partida. El CSS era correcto; la prueba, intermitente.

### Deuda restante

- Los modales de la pila inferior no se marcan `inert`, así que un lector de
  pantalla todavía puede recorrerlos. La trampa de foco cubre el teclado, no la
  navegación por objetos del lector.
- El `backdrop-blur` a pantalla completa recompone el canvas de MapLibre
  mientras el modal está abierto; medible en gama baja Android.
