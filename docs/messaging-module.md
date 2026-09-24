# Módulo Mensajería / Delivery — TransferCuba

Plataforma de servicios locales: `USER` (solicita) / `BUSINESS` (vende) /
`MESSENGER` (entrega) sobre el mapa. Todo validado en backend; React solo
refleja. Persistencia en Postgres/Neon (patrón `lib/db.ts`), sin nuevas
dependencias.

## Estado de fases

| Fase | Descripción | Backend | UI | Estado |
|---|---|---|---|---|
| 0 | **Identidad teléfono + contraseña** (`users`/`sessions`) | — | — | ✅ completo (Sprint 10) |
| 1 | **Modelo delivery** (mensajeros, pricing, plataforma, carreras, pagos) | — | — | ✅ completo (Sprint 11) |
| 2 | Solicitud de carrera: estimate, crear, historial, GET [id] | ✅ backend | ✅ UI | ✅ completo (Sprint 13) |
| 3 | Matching mensajero: available, accept, steps, cancel, trust | ✅ backend | ✅ UI | ✅ completo (Sprint 13) |
| 4 | Tracking en mapa + transición de estados | ✅ backend | ✅ UI | ✅ completo (Sprint 14) |
| 5 | Alta pagada de mensajeros (tarifa + captura WhatsApp) | ✅ backend | ✅ UI | ✅ completo (commit f73567d) |
| 6 | Historial de carreras, valoraciones, polling → SSE | ✅ backend + SSE | ✅ UI | ✅ completo (commit b8dcc54) |

---

## Fase 0 — Identidad (hecho, Sprint 10)

- Registro por **teléfono (7-15 dígitos, normalizado) + PIN (4-8 dígitos)**,
  sin email. PIN hasheado con `scrypt` (`node:crypto`, sal aleatoria).
- Sesión en cookie HttpOnly `tc_session` (30 días, `secure` en prod, `SameSite=Lax`).
- Roles: `USER` (defecto) / `BUSINESS` / `MESSENGER` / `ADMIN`. Estados:
  `active` / `blocked`.
- El alta de mensajero **no** pasa por el registro genérico: es el alta
  pagada de la Fase 5 (aprobación admin explícita).
- `businesses.owner_user_id` opcional permite vincular negocios al usuario.

### API `/api/account/*` (auth de usuario, distinta de la admin en `/api/auth/*`)

| Endpoint | Método | Rol | Comportamiento |
|---|---|---|---|
| `/api/account/register` | POST | anónimo | 201 + cookie / 409 teléfono existe / 400 validación / 503 BD caída |
| `/api/account/login` | POST | anónimo | 200 + cookie / 401 genérico / 403 bloqueada |
| `/api/account/me` | GET | cualquiera | `{ authenticated, user }` |
| `/api/account/logout` | POST | cualquiera | revoca sesión + borra cookie best-effort |

### Componentes

- `lib/db-auth.ts` — DAO (pool compartido + circuit breaker 60 s, sin
  fallback in-memory: sin BD → 503).
- `lib/auth.ts` — `hashPin`/`verifyPin`/`isValidPassword`/`isValidName`, cookies,
  `requireAuth`/`requireRole`.
- `lib/hooks/useAuth.ts` — estado de sesión en el cliente (hidrata con `/me`).
- `components/GoogleMapsAuthModal.tsx` — login/registro/perfil; acceso desde
  `GoogleMapsTopBar` (botón "Cuenta") y `GoogleMapsSideDrawer`.

---

## Fase 1 — Modelo de datos (hecho, Sprint 11)

Migración `db/migrate_delivery.sql` (idempotente), DAO `lib/db-delivery.ts`
(pool compartido con identidad vía `lib/db-auth.ts`, breaker único, sin
fallback in-memory) y motor de precios `lib/pricing.ts`.

### Tablas

- **`pricing_config`** (singleton `id=1`): `base_cup`, `free_km`,
  `small_km_threshold` + `small_km_rate_cup`, `large_km_threshold` +
  `large_km_rate_cup`, `extra_km_rate_cup`, `updated_by`, `updated_at`.
  CHECK de coherencia (tramos crecientes, tarifas ≥ 0). Defaults seed:
  200/3/5·50/10·70/100.
- **`platform_config`** (singleton `id=1`): `messenger_fee_cup`,
  `messenger_pay_card`, `messenger_whatsapp`, `updated_by`, `updated_at`.
- **`messengers_profiles`**: perfil operativo (`vehicle` CHECK, `service_areas[]`,
  `status PENDING|ACTIVE|SUSPENDED`, `rating 0-5`, `completed_orders`,
  `active_since`), UNIQUE por `user_id`.
- **`delivery_requests`**: la carrera. Código `code TC-XXXXX` UNIQUE (5 chars
  base36 del UUID, retry en colisión), `status` con CHECK, `requester_id`
  (RESTRICT), `messenger_id` (SET NULL), paquete (`package_type`,
  `fragile`, `payable_on_delivery`), pickup/dropoff con lat/lng+address+note,
  ruta cacheada (`distance_km`, `duration_min`, `route_geojson`) y tarifas
  (`base_fare_cup`, `total_fare_cup`), `cancel_reason`/`cancelled_by`,
  `trusted_by`/`trusted_at` (fase 3), timestamps por evento. Índice parcial
  `(status) WHERE status='PENDING'` para matching, + índices por
  solicitante/mensajero.
- **`delivery_status_events`**: auditoría de cada transición
  (`from_status`, `to_status`, `actor_id`, `actor_role`, `note`).
- **`messengers_payments`**: ledger del alta/activación
  (`amount_cup > 0`, `status PENDING|PAID|CONFIRMED|REJECTED`, `reference`,
  `evidence_note`, `confirmed_by`, `confirmed_at`).

### Transiciones (whitelist dura en backend)

```
PENDING   → ACCEPTED | CANCELLED | EXPIRED
ACCEPTED  → PICKED_UP | CANCELLED
PICKED_UP → IN_TRANSIT
IN_TRANSIT→ DELIVERED
(DELIVERED / CANCELLED / EXPIRED son terminales)
```

- `transitionDelivery` bloquea la fila (`SELECT ... FOR UPDATE`), valida que el
  estado actual esté en `fromStatuses` **y** que el destino esté en la
  whitelist (`ALLOWED_TRANSITIONS`), actualiza estado+timestamps
  (`responded_at`, `picked_up_at`, `delivered_at`, `cancelled_at`,
  `cancel_reason`/`cancelled_by`) y asigna `messenger_id` al aceptar, todo en
  una transacción + evento de auditoría.
- La doble aceptación es imposible (segundo UPDATE → 0 filas).
- `expirePendingDeliveries()` es **lazy** (15 min, se llama en cada listado
  de disponibles).

### Precios (`lib/pricing.ts`)

`computeFare(distanceKm, cfg)` — base incluye `free_km`; luego por km según
el tramo. `fareBreakdown()` expone el desglose para la UI. Ejemplos con el
seed: 2 km = 200, 5 km = 300, 10 km = 650, 12 km = 850.

---

## Fase 2 — Solicitud de carrera (completo, Sprint 13)

### Endpoints implementados

| Endpoint | Método | Rol | Comportamiento |
|---|---|---|---|
| `/api/deliveries/estimate` | GET | USER/BUSINESS/ADMIN | Params `fromLat`, `fromLng`, `toLat`, `toLng`; calcula OSRM + `computeFare`; retorna `distanceKm`, `durationMin`, `totalFareCup`, `breakdown`. 502 si OSRM cae. |
| `/api/deliveries` | POST | USER/BUSINESS/ADMIN | Body: `packageType`, `packageNote?`, `fragile?`, `payableOnDelivery?`, `pickup{lat,lng,address,note?}`, `dropoff{...}`. OSRM una vez (write-time), persiste `distance_km` + `route_geojson` + `total_fare_cup`. Retorna 201 con DTO completo. |
| `/api/deliveries` | GET | USER/BUSINESS/ADMIN, MESSENGER | **Rol-aware**: el solicitante (USER/BUSINESS/ADMIN) ve su historial; el MESSENGER ve las carreras que le han **asignado** (todas sus filas, últimas 30, con locations+roles). |
| `/api/deliveries/[id]` | GET | solicitante / admin / mensajero asignado | Filtrado por rol: solicitante+admin ven todo; mensajero asignado todo excepto cuando es PENDING (no debería suceder: PENDING se ve en `/available`). Otros → 403. |

### Validación (`lib/delivery-validate.ts`)

- `PACKAGE_TYPES`: `documento`, `comida`, `medicina`, `paquete`, `generic`.
- `toCoord(v)`: acepta number o string parseable, rango ±90/180.
- `isValidAddress(v)`: string limpio 3–200 chars.
- `toOptionalNote(v)`: null si vacío, en caso contrario trim ≤300 chars.

### DTO de privacidad (`lib/delivery-dto.ts`)

`toDeliveryDTO(row, opts)` produce el objeto público:
```ts
{
  id, code, status, packageType, packageNote, fragile, payableOnDelivery,
  pickup: {lat, lng, address, note} | null,    // includeLocations
  dropoff: {lat, lng, address, note} | null,   // includeLocations
  distanceKm, durationMin, totalFareCup,
  requestedAt, respondedAt, pickedUpAt, deliveredAt, cancelledAt, updatedAt,
  trustedBy, trustedAt,                         // confianza (fase 3)
  requester: {id, name} | null,                 // includeRequester
  messenger: {id, name} | null                  // includeMessenger
}
```

---

## Fase 3 — Matching mensajero (completo, Sprint 13)

### Endpoints implementados

| Endpoint | Método | Rol | Comportamiento |
|---|---|---|---|
| `/api/deliveries/available` | GET | MESSENGER | Lista carreras PENDING (máx 30). Sin dirección de entrega, sin identidad del solicitante; solo pickup + distanceKm + totalFareCup + packageInfo. Llama `expirePendingDeliveries()` lazy al inicio. 403 si no es MESSENGER. |
| `/api/deliveries/[id]` | PATCH | varios | Actions (ver abajo). |

### Acciones de `PATCH /[id]`

Body: `{ "action": "...", "note?" }`.

| action | Rol autorizado | From → To | Guard extra |
|---|---|---|---|
| `accept` | MESSENGER | PENDING → ACCEPTED | Perfil `messengers_profiles.status` debe ser `ACTIVE`; si no → 403. Doble accept → 409. |
| `pick_up` | MESSENGER (asignado) | ACCEPTED → PICKED_UP | `messenger_id` coincide con el usuario → 403 si no. |
| `in_transit` | MESSENGER (asignado) | PICKED_UP → IN_TRANSIT | — |
| `deliver` | MESSENGER (asignado) | IN_TRANSIT → DELIVERED | — |
| `cancel` | solicitante (PENDING) o ADMIN (PENDING/ACCEPTED/PICKED_UP/IN_TRANSIT) | → CANCELLED | El solicitante solo cancela antes de aceptar. Admin puede cancelar en cualquier estado activo. `note` se guarda como `cancel_reason`. |
| `trust` | solicitante | DELIVERED → set `trusted_by`/`trusted_at` | Solo una vez por carrera. Si no es DELIVERED o ya existe → 400. |

### Respuesta de PATCH

Todos los actions exitosos retornan `{ success: true, delivery: <DeliveryDTO> }` con
`includeLocations: true, includeRequester: true, includeMessenger: true`.

Errores HTTP mapeados:
- 400: JSON inválido / acción inválida.
- 401: sin sesión.
- 403: rol o perfil no corresponde.
- 404: carrera no encontrada.
- 409: transición inválida (ej. doble aceptación, cancelar carrera aceptada).
- 503: BD caída.

---

## Fase 4 — Capas de mapa y polling (completo, Sprint 14)

Sin cambios de backend: reutiliza `/api/deliveries` (GET role-aware) y
`/api/deliveries/available` con polling en el cliente.

### Capas de mapa (`MapLibreMap.tsx`)

- `deliveries-requests-source` → capa `deliveries-requests-layer`: puntos de
  **origen** de las solicitudes PENDING (solo visible para MESSENGER). Círculo
  emerald con popup de `code` + tarifa al hover; clic abre el tablón.
- `active-delivery-source` → capas `active-delivery-line-layer` (línea punteada
  cielo pickup→dropoff) + `A` (emerald, origen) + `B` (rose, destino) con
  etiquetas. Se pinta para el solicitante (su carrera activa) y el mensajero
  (carrera asignada).

### Polling en el cliente (`lib/hooks/useDeliveries.ts`)

- **Solicitante**: tras crear una carrera se guarda `trackingId` y se consulta
  `GET /api/deliveries` cada **12 s**; al cambiar el estado se lanza toast
  (`ACCEPTED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`, `EXPIRED`).
  Al estado terminal se detiene el polling. Al iniciar sesión retoma el tracking
  de una carrera activa pendiente.
- **Mensajero**: `refreshMessenger(true)` (silencioso) cada **15 s** — refresca
  el tablón (`available`) y su carrera activa asignada; solo salta a la pestaña
  "Mi carrera" cuando aparece una carrera nueva.

---

## Fase 5 — Alta pagada de mensajeros (completo, commit f73567d)

- El solicitante consulta la configuración de alta mediante `GET /api/messenger/apply`
  y envía vehículo, zonas de servicio y referencia de pago mediante `POST`.
- El backend crea `messengers_profiles` en `PENDING` y un pago
  `messengers_payments` en `PENDING`; el comprobante se gestiona por WhatsApp.
- Administración configura tarifa/tarjeta/WhatsApp en `/api/admin/platform`, lista
  solicitudes en `/api/admin/messengers` y confirma, rechaza, suspende o reactiva
  en `/api/admin/messengers/[userId]`.
- Confirmar un pago cambia el perfil a `ACTIVE` y el rol de usuario a `MESSENGER`.
- UI: `lib/hooks/useMessengerApplication.ts`, `MessengerAdminPanel` y el flujo de
  alta dentro de `GoogleMapsMessengerModal`.

### Suscripción con validez y renovación

Ser mensajero caduca. Por defecto **300 CUP cada 30 días**, ambos configurables
por administración (`messenger_fee_cup`, `messenger_period_days`).

- **Pago en efectivo o por transferencia.** En transferencia se exige referencia
  y se envía comprobante por WhatsApp; en efectivo se entrega en mano y la nota
  es opcional. `messengers_payments.method` lo registra.
- **Renovación**: la pide el propio mensajero desde el tablón, antes o después de
  vencer. `kind = 'renovacion'`; el perfil **no** baja a `PENDING`, así que
  mientras le queden días sigue trabajando aunque el pago esté por confirmar.
- **Al confirmar**: `expires_at = GREATEST(expires_at, now()) + covers_days`, de
  modo que renovar pronto no penaliza.
- **Al vencer**: conserva rol, perfil e historial; pierde el tablón
  (`GET /api/deliveries/available` → 403 `subscriptionExpired`) y la posibilidad
  de aceptar (`PATCH /[id]` con `accept` → 403). Los pasos de una carrera ya
  aceptada siguen permitidos.
- **Avisos**: a 7 días o menos, una franja sobre el tablón con la fecha y los días
  restantes; al vencer, la pantalla de renovación sustituye al tablón.
- **Panel de administración**: lista por **pago pendiente**
  (`GET /api/admin/messengers?pendingPayment=1`), no por estado de perfil — una
  renovación la pide un perfil ya `ACTIVE` y filtrar por perfil la dejaba
  invisible. Cada tarjeta muestra alta/renovación, método, vencimiento actual y
  los días que suma al confirmar.

## Fase 6 — Historial y valoraciones (backend, en curso)

Migración `db/migrate_delivery_phase6.sql` (idempotente) y DAO en
`lib/db-delivery.ts`. Los agregados `messengers_profiles.rating` y
`completed_orders` existían desde la Fase 1 pero **nunca se escribían**: ahora
son caché derivada y la migración recalcula `completed_orders` una vez desde
las carreras ya entregadas.

### Endpoints

| Endpoint | Método | Rol | Comportamiento |
|---|---|---|---|
| `/api/deliveries/history` | GET | cualquiera con sesión | Paginado con cursor opaco `(requested_at, id)`. `limit` 1–50 (30 por defecto), `status` opcional. Role-aware: USER/BUSINESS ven lo que pidieron, MESSENGER lo asignado, ADMIN todo. Respuesta `{ deliveries, nextCursor }`. |
| `/api/deliveries/[id]/reviews` | GET | quien puede ver la carrera | Valoraciones visibles; `hidden`/`removed` solo para ADMIN. |
| `/api/deliveries/[id]/reviews` | POST | solicitante | 201 / 400 puntuación o comentario / 403 no es suya o no entregada / 404 / 409 ya valorada / 503. |
| `/api/admin/deliveries/reviews/[reviewId]` | PATCH | admin | `hide`, `restore`, `remove`. `remove` es lógico: la fila se conserva. |
| `/api/messengers/[userId]/stats` | GET | el propio mensajero o admin | `{ rating, reviewCount, completedOrders }`. |

### Decisiones

- **La unicidad la impone el índice**, no un SELECT previo: dos envíos
  simultáneos chocan en `UNIQUE (delivery_id, requester_id)` (23505) y el
  backend lo traduce a 409. Un `SELECT` antes del `INSERT` dejaría una ventana
  de carrera.
- **El cursor es `(requested_at, id)`**, no solo la fecha: dos carreras pueden
  compartir timestamp y un cursor por fecha sola se saltaría filas o las
  repetiría. Se pide una fila de más para saber si hay página siguiente sin
  hacer un `COUNT`.
- **`rating` es `null` sin valoraciones**, no 0 ni 5: "sin datos" no es una
  nota. La caché del perfil sí vuelve a 5.0 porque es el valor con el que nace.
- **`InvalidReviewError` lleva un `reason`** (`ownership`, `state`,
  `duplicate`, `input`), no un código HTTP: el DAO no sabe de HTTP y el
  endpoint traduce.
- **`completed_orders` se incrementa en la transición a `DELIVERED`**, dentro de
  la misma transacción. La whitelist impide volver a entrar en ese estado, así
  que no puede contarse dos veces.

### Pendiente de la Fase 6

- Eventos en vivo por SSE (`GET /api/deliveries/stream`), con el polling actual
  como fallback.
- UI: historial y valoración en `GoogleMapsDeliveryModal`, historial y
  estadísticas en `GoogleMapsMessengerModal`.

## Fases siguientes (resumen)

- **Fase 5 (alta pagada)**: admin fija costo en CUP (`messenger_fee_cup`) y
  tarjeta destino (`messenger_pay_card`). El mensajero paga y **envía la
  captura de la transferencia por WhatsApp al admin** (comprobante EXTERNO,
  sin subida de imágenes). El admin confirma → `approved` +
  `users.role='MESSENGER'`. Correo/escalado quedan como paso manual.
- **Fase 6**: historial paginado para solicitante y mensajero,
  valoración del mensajero tras una entrega `DELIVERED`, agregados de rendimiento
  y eventos en vivo por SSE. El polling actual de 12/15 s queda como fallback.
  Backend, SSE y UI completos (commits `94c1d2a`, `c5f2eca`, `b8dcc54`).

---

## UI (Sprint 13)

- `lib/delivery-client.ts`: tipos DTO y constantes del cliente (sin importar BD).
- `lib/hooks/useDeliveries.ts`: estado compartido — vistas form/success/pick/history
  del solicitante y tablón/carrera activa del mensajero; estimate con debounce,
  submit POST, historial, refresh/accept/steps.
- `components/GoogleMapsDeliveryModal.tsx`: solicitud (tipo de paquete, fragilidad,
  pago al recibir, origen/destino por mapa o GPS, tarjeta de estimación, éxito con
  código, historial).
- `components/GoogleMapsMessengerModal.tsx`: tablón de carreras disponibles (sin
  dirección de entrega ni identidad) + carrera activa con pasos
  `pick_up → in_transit → deliver`.
- `components/MapLibreMap.tsx`: marcadores delivery (A verde / B rojo) y banner de
  picking con `cursor-crosshair`; el clic del mapa se rutea a `useDeliveries` desde
  `app/page.tsx` cuando `picking` está activo.

---

## Privacidad por rol

- `GET /api/deliveries/[id]`: solicitante+admin ven todo; mensajero asignado ve
  todo excepto cuando PENDING (se usa `/available` en su lugar).
- `GET /api/deliveries/available`: sin dirección de entrega, sin identidad del
  solicitante; solo pickup + distancia/tarifa para que el mensajero decida.
- `GET /api/deliveries` (historial): role-aware — el solicitante ve sus carreras
  propias; el MESSENGER ve las que le han sido asignadas (últimas 30, con
  locations+roles).

## Pool de BD

Ambos DAO (`db-auth` y `db-delivery`) comparten el mismo pool de `pg` (función
`getDbPool()` en `lib/db-auth.ts`) con un circuit breaker único (60 s).
Error 503 controlado: `DbUnavailableError` se lanza cuando la BD no responde
o el breaker está activo.

## Reglas transversales

- Código `TC-XXXXX`: 5 chars base36 derivados del UUID.
- Sin dependencias nuevas; DTOs tipados a mano.
- `page.tsx` sigue delgado; estado de delivery en hooks nuevos
  (`lib/hooks/useDeliveries*`).
- No romper el camino GeoJSON+clusters ni los tiles MVT de negocios.
- OSRM demo (`router.project-osrm.org`) usado sin API key; sin SLA.
