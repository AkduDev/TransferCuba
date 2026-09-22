# AGENTS.md — Guía para agentes de código (opencode/claude)

## Proyecto

TransferCuba — mapa/directorio de negocios con transferencia en Cuba.
Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + MapLibre GL JS.
Gestor de paquetes: **Bun**. Documentación adicional en `docs/`.

## Comandos

```bash
bun run dev      # servidor de desarrollo (localhost:3000)
bun run build    # build de producción — verificar antes de terminar tareas grandes
bun run lint     # ESLint — correr tras cambios de código
bun run test:e2e # Playwright; levanta next dev solo
bunx tsc --noEmit  # typecheck rápido
```

Regla: tras cualquier cambio de código, correr `bun run lint` y si es posible
`bunx tsc --noEmit`. `bun run build` para verificar integrales.

Las pruebas que necesitan sesión (mensajería, suscripción, valoraciones, SSE)
se **saltan solas** sin `E2E_DATABASE_URL`: exigen una base APARTE y nunca
escriben en la de la aplicación. En Neon lo natural es una rama. La moderación
de valoraciones pide además `E2E_ADMIN_PASSWORD`.

```bash
E2E_DATABASE_URL='postgresql://…/neondb-e2e' bun run test:e2e
```

Ojo con el lint: el repo arrastra 3 errores previos de
`react-hooks/set-state-in-effect` y 1 aviso. Compara contra esa línea base
(`git show HEAD:<fichero> | bunx eslint --stdin --stdin-filename <fichero>`)
antes de dar por tuyo un error.

## Estructura y convenciones

- `app/page.tsx` es un orquestador DELGADO (~110 líneas): el estado vive en
  hooks de `lib/hooks/` (useMapViewport, useFilters, useGeolocation,
  useGeocoding, useBusinessesData, useBusinessActions, useModals, useToast,
  useAuth, useDeliveries, useMessengerApplication) y baja por props. No añadir
  estado nuevo a page.tsx.
- Componentes de UI en `components/` con **nombre propio, sin prefijo**: el
  antiguo `GoogleMaps*` se eliminó en el rediseño V2. Hoy son `TopBar`,
  `SideDrawer`, `ExplorePanel`, `BottomSheet`, `BusinessCard`, `ClusterCard`,
  `MapControls`, `MapAttribution`, `PinningControls`, `Toast`, y los modales
  con sufijo `*Modal` (`AuthModal`, `DeliveryModal`, `MessengerModal`,
  `FiltersModal`, `LocationPickerModal`, `RegisterBusinessModal`,
  `AdminDashboardModal`).
- Todo modal y el cajón lateral se montan sobre `components/ModalShell.tsx`,
  que aporta la semántica de diálogo (role, aria-modal, Escape, trampa y
  devolución de foco, clic en el fondo, bloqueo de scroll y pila cuando hay
  varios abiertos). No volver a escribir el `div` de capa a mano.
- Lógica de dominio y datos en `lib/`: `cuba-data.ts` (tipos, seed,
  provincias), `osrm.ts`, `nominatim.ts`, `cloudinary.ts`, `dto.ts`, `db.ts`;
  identidad en `auth.ts`/`db-auth.ts` (usuarios) y `admin-auth.ts` (panel, es
  OTRA superficie); mensajería en `db-delivery.ts`, `delivery-dto.ts`,
  `delivery-client.ts`, `delivery-validate.ts`, `pricing.ts`.
- `MapLibreMap` se importa SIEMPRE con `dynamic(..., { ssr: false })` (requiere
  `window`) y envuelto en `MapErrorBoundary`.
- Vector tiles: el cutover **ya está hecho**. `MapLibreMap` consume un source
  `vector` contra `GET /api/tiles/[z]/[x]/[y]`, que sirve MVT vía
  `queryBusinessesMvt` (`lib/db.ts`) y `get_businesses_mvt(z,x,y)` de
  `db/schema.sql` (PostGIS puro, solo negocios `active`). Ya no hay camino
  GeoJSON+clusters de negocios en el cliente; el GeoJSON que queda en
  `MapLibreMap` es solo para las capas de delivery.
- Path alias `@/*` → raíz del proyecto.

## Código

- TypeScript estricto; no usar `any` salvo fronteras externas.
- Sin comentarios salvo que se pidan; nombres autoexplicativos.
- Tailwind utility classes inline; tema visual: emerald=transfer activa,
  slate=neutros, estilo Google Maps (ver componentes existentes).
- UI en español (Cuba como audiencia).
- Commits estilo conventional: `feat:`, `fix:`, `docs:`, `chore:` (repo usa
  inglés en histórico pero es apto español).

## Despliegue y entornos

Producción va en Vercel (`transfercuba`) con integración a GitHub sobre `main`:
**un push a `main` despliega**. La base es Neon (`soft-shape-61529281`), con una
rama `preview` a la que apuntan los entornos Preview y Development para que una
vista previa no escriba en producción.

Runbook completo —orden de las migraciones, deriva entre `schema.sql` y la base
real, cómo aplicar SQL cuando el puerto 5432 está bloqueado, y las rarezas del
CLI de Vercel— en [`docs/operaciones.md`](docs/operaciones.md).

Las fotos de negocios van a Cloudinary (cloud `ds7tspnjm`, preset unsigned
`transfercuba_businesses`), configurado en los tres entornos. Las claves de API
—solo necesarias para el borrado de assets— siguen sin poner: el borrado degrada
con gracia, pero deja el fichero huérfano en Cloudinary.

## Reglas del dominio

- Solo negocios `status === 'active'` se muestran en mapa/listas.
- Registro nuevo → `pending` → requiere aprobación admin.
- Servicios externos Nominatim/OSRM: máximo 1 req/s, con `User-Agent`
  identificatorio. No abusar.
- Migraciones en `db/`, idempotentes. El orden importa y **no es alfabético**:
  `schema.sql` → `migrate_auth.sql` → `migrate_delivery.sql` →
  `migrate_promotions_index.sql` → `migrate_delivery_phase6.sql` →
  `migrate_has_delivery.sql`. (`migrate_v2.sql` y `migrate_1_9_drop_legacy.sql`
  son históricos, solo para bases anteriores a 1.9.) Un cambio de esquema añade
  migración **y** actualiza `schema.sql`.
- Persistencia: `localStorage` clave `transfercuba_businesses_v2` como cache
  offline del frontend; fuente real es Postgres/Neon vía `lib/db.ts`
  (tablas normalizadas V2 desde el DAO — ver `db/schema.sql`; `hours` y los
  contadores de `businesses` son cache plana, las columnas legacy de 1.9 ya
  no existen).

## No hacer

- No añadir dependencias sin necesidad (proyecto deliberadamente libre de
  librerías de estado/UI pesadas).
- No usar Leaflet ni `motion` ni Firebase (eliminados por dead code).
- **Mapas y rutas siguen sin API keys**: OpenFreeMap, OSM, OSRM y Nominatim son
  gratuitos y así se quedan. La única excepción es **Cloudinary** para las fotos
  de negocios (`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
  `NEXT_PUBLIC_CLOUDINARY_*`); no añadir proveedores de pago más allá de ese.
