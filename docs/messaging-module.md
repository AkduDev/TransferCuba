# Módulo Mensajería / Delivery — TransferCuba

Plataforma de servicios locales: `USER` (solicita) / `BUSINESS` (vende) /
`MESSENGER` (entrega) sobre el mapa. Todo validado en backend; React solo
refleja. Persistencia en Postgres/Neon (patrón `lib/db.ts`), sin nuevas
dependencias.

## Estado de fases

| Fase | Descripción | Estado |
|---|---|---|
| 0 | **Identidad teléfono + PIN** (`users`/`sessions`) | ✅ hecho (Sprint 10) |
| 1 | Modelo delivery (mensajeros, pricing, plataforma, carreras, pagos) | ⏳ |
| 2 | Solicitud de carrera (form + precio estimado + OSRM server-side una vez) | ⏳ |
| 3 | Matching mensajero (listado, aceptar, confiar) | ⏳ |
| 4 | Tracking en mapa + transición de estados | ⏳ |
| 5 | Alta pagada de mensajeros (tarifa + captura WhatsApp externa) | ⏳ |
| 6 | Historial de carreras, valoraciones, polling → SSE | ⏳ |

## Fase 0 — Identidad (término-clave: teléfono + PIN)

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
| `/api/account/register` | POST | anónimo | 201 + cookie de sesión / 409 teléfono ya existe / 400 validación / 503 BD caída |
| `/api/account/login` | POST | anónimo | 200 + cookie / 401 genérico (no revela cuál campo falló) / 403 bloqueada |
| `/api/account/me` | GET | cualquiera | `{ authenticated, user }` |
| `/api/account/logout` | POST | cualquiera | revoca sesión + borra cookie best-effort |

Alcance por sesión: `requireAuth` / `requireRole` en `lib/auth.ts` (server-only).

### Componentes

- `lib/db-auth.ts` — DAO (pool propio + circuit breaker 60 s, **sin** fallback
  in-memory: sin BD → 503).
- `lib/auth.ts` — `hashPin`/`verifyPin`/`isValidPin`/`isValidName`, cookies,
  `requireAuth`/`requireRole`.
- `lib/hooks/useAuth.ts` — estado de sesión en el cliente (hidrata con `/me`).
- `components/GoogleMapsAuthModal.tsx` — login/registro/perfil; acceso desde
  `GoogleMapsTopBar` (botón "Cuenta") y `GoogleMapsSideDrawer`.

## Fase 1 — Modelo de datos (pendiente de crear)

Tablas previstas en `db/migrate_delivery.sql`:

- `messengers_profiles(user_id FK, id_card?, zip?, city, active, confirmed_at)`.
- `pricing_config(template, base_cup, free_km, extra_km_small_cup, small_km_threshold, extra_km_large_cup, large_km_threshold)` — tramos por kilómetro.
- `platform_config(messenger_fee_cup, messenger_pay_card, messenger_whatsapp)` —
  alta pagada.
- `delivery_requests(...)` — carrera con `status` CHECK y `code TC-XXXXX`.
- `delivery_status_events(...)` — auditoría de transiciones.
- `messengers_payments(...)` — página de comprobante del pago del mensajero.

### Estados de carrera

```
PENDING → ACCEPTED → PICKED_UP → IN_TRANSIT → DELIVERED
   │          │
   └─CANCELLED  └─CANCELLED
PENDING ──(15 min sin aceptar, lazy)──> EXPIRED
```

- `CANCELLED` de `PENDING` la emite solo el solicitante; de `ACCEPTED`
  requiere consenso (ambas partes o admin).
- `EXPIRED` por lazy check (no cron).

### Pricing por tramos (configurable en admin)

Base incluye 3 km; luego incrementos por km según el rango
(3-5 km, 5-10 km, 10 km+). Tramos editables desde el panel admin.

## Fases siguientes (resumen)

- **Fase 2**: `POST /api/deliveries` estima precio + ruta vía OSRM **una vez**
  (server-side) y persiste `distance_km` + `route_geojson`; no recalcular en
  cada vista.
- **Fase 3**: `GET /api/deliveries/available` (solo MESSENGER), aceptar con
  transacción + filas afectadas (evita doble aceptación). **Confiar** = que el
  solicitante confirme que el mensajero recibió el dinero al entregar.
- **Fase 4**: capas de mapa `deliveries-requests-source` y
  `active-delivery-source`; polling 10-15 s de carreras activas; SSE/WebSocket
  en Fase 6.
- **Fase 5 (alta pagada)**: admin fija costo en CUP (`messenger_fee_cup`) y
  tarjeta destino (`messenger_pay_card`). El mensajero paga y **envía la
  captura de la transferencia por WhatsApp al admin** (comprobante EXTERNO,
  sin subida de imágenes). El admin confirma → `approved` +
  `users.role='MESSENGER'`. Correo/escalado quedan como paso manual.
- **Fase 6**: historial + valoraciones; migrar polling a SSE (defer).

## Privacidad por rol

`GET /api/deliveries/[id]` filtra campo a campo según rol: solicitante ve su
propia integridad, mensajero asignado ve datos de contacto, admin ve todo.
Los mensajeros compiten por carreras `PENDING` sin ver datos del solicitante.

## Reglas transversales

- Código `TC-XXXXX`: 5 chars base36 derivados del UUID.
- Sin dependencias nuevas; DTOs tipados a mano.
- `page.tsx` sigue delgado; estado de delivery en hooks nuevos
  (`lib/hooks/useDeliveries*`).
- No romper el camino GeoJSON+clusters ni los tiles MVT de negocios.