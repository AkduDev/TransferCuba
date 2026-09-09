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
bunx tsc --noEmit  # typecheck rápido
```

Regla: tras cualquier cambio de código, correr `bun run lint` y si es posible
`bunx tsc --noEmit`. `bun run build` para verificar integrales.

## Estructura y convenciones

- `app/page.tsx` es el orchestrador: TODO el estado vive ahí y baja por props.
  Los componentes hijos no mantienen estado de negocio propio.
- Componentes de UI estilo "Google Maps" en `components/` con prefijo
  `GoogleMaps*`, modales con sufijo `*Modal`.
- Lógica de dominio y datos en `lib/`: `cuba-data.ts` (tipos, seed,
  provincias), `osrm.ts`, `nominatim.ts`.
- `MapLibreMap` se importa SIEMPRE con `dynamic(..., { ssr: false })` (requiere
  `window`) y envuelto en `MapErrorBoundary`.
- Path alias `@/*` → raíz del proyecto.

## Código

- TypeScript estricto; no usar `any` salvo fronteras externas.
- Sin comentarios salvo que se pidan; nombres autoexplicativos.
- Tailwind utility classes inline; tema visual: emerald=transfer activa,
  slate=neutros, estilo Google Maps (ver componentes existentes).
- UI en español (Cuba como audiencia).
- Commits estilo conventional: `feat:`, `fix:`, `docs:`, `chore:` (repo usa
  inglés en histórico pero es apto español).

## Reglas del dominio

- Solo negocios `status === 'active'` se muestran en mapa/listas.
- Registro nuevo → `pending` → requiere aprobación admin.
- Servicios externos Nominatim/OSRM: máximo 1 req/s, con `User-Agent`
  identificatorio. No abusar.
- Persistencia actual: `localStorage` clave `transfercuba_businesses_v2`
  (frontend) + store in-memory en `app/api/businesses/route.ts`. Aún no
  conectados entre sí.

## No hacer

- No añadir dependencias sin necesidad (proyecto deliberadamente libre de
  librerías de estado/UI pesadas).
- No usar Leaflet ni `motion` ni Firebase (eliminados por dead code).
- No introducir API keys: el diseño es 100% OSM/gratuito.
