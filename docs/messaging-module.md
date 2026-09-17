# Módulo Mensajería / Delivery — TransferCuba

Plataforma de servicios locales: `USER` (solicita) / `BUSINESS` (vende) /
`MESSENGER` (entrega) sobre el mapa. Todo validado en backend; React solo
refleja. Persistencia en Postgres/Neon (patrón `lib/db.ts`), sin nuevas
dependencias.

## Estado de fases

| Fase | Descripción | Backend | UI | Estado |
|---|---|---|---|---|
| 0 | **Identidad teléfono + PIN** (`users`/`sessions`) | — | — | ✅ completo (Sprint 10) |
| 1 | **Modelo delivery** (mensajeros, pricing, plataforma, carreras, pagos) | — | — | ✅ completo (Sprint 11) |
| 2 | Solicitud de carrera: estimate, crear, historial, GET [id] | ✅ backend | ⏳ pendiente | Backend listo |
| 3 | Matching mensajero: available, accept, steps, cancel, trust | ✅ backend | ⏳ pendiente | Backend listo |
| 4 | Tracking en mapa + transición de estados | ⏳ pendiente | ⏳ pendiente | — |
| 5 | Alta pagada de mensajeros (tarifa + captura WhatsApp) | ⏳ pendiente | ⏳ pendiente | — |
| 6 | Historial de carreras, valoraciones, polling → SSE | ⏳ pendiente | ⏳ pendiente | — |

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
- `lib/auth.ts` — `hashPin`/`verifyPin`/`isValidPin`/`isValidName`, cookies,
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

## Fase 2 — Solicitud de carrera (backend ✅, UI ⏳)

### Endpoints implementados

| Endpoint | Método | Rol | Comportamiento |
|---|---|---|---|
| `/api/deliveries/estimate` | GET | USER/BUSINESS/ADMIN | Params `fromLat`, `fromLng`, `toLat`, `toLng`; calcula OSRM + `computeFare`; retorna `distanceKm`, `durationMin`, `totalFareCup`, `breakdown`. 502 si OSRM cae. |
| `/api/deliveries` | POST | USER/BUSINESS/ADMIN | Body: `packageType`, `packageNote?`, `fragile?`, `payableOnDelivery?`, `pickup{lat,lng,address,note?}`, `dropoff{...}`. OSRM una vez (write-time), persiste `distance_km` + `route_geojson` + `total_fare_cup`. Retorna 201 con DTO completo. |
| `/api/deliveries` | GET | USER/BUSINESS/ADMIN | Historial propio (últimas 30, completo con locations+roles). |
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

## Fase 3 — Matching mensajero (backend ✅, UI ⏳)

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

## Fases siguientes (resumen)

- **Fase 4**: capas de mapa `deliveries-requests-source` y
  `active-delivery-source`; polling 10-15 s de carreras activas; SSE/WebSocket
  en Fase 6.
- **Fase 5 (alta pagada)**: admin fija costo en CUP (`messenger_fee_cup`) y
  tarjeta destino (`messenger_pay_card`). El mensajero paga y **envía la
  captura de la transferencia por WhatsApp al admin** (comprobante EXTERNO,
  sin subida de imágenes). El admin confirma → `approved` +
  `users.role='MESSENGER'`. Correo/escalado quedan como paso manual.
- **Fase 6**: historial + valoraciones; migrar polling a SSE (defer).

---

## Privacidad por rol

- `GET /api/deliveries/[id]`: solicitante+admin ven todo; mensajero asignado ve
  todo excepto cuando PENDING (se usa `/available` en su lugar).
- `GET /api/deliveries/available`: sin dirección de entrega, sin identidad del
  solicitante; solo pickup + distancia/tarifa para que el mensajero decida.
- `GET /api/deliveries` (historial): solo carreras propias del solicitante.

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
