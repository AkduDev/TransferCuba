# API REST — `/api/businesses`

Base URL (dev): `http://localhost:3000/api/businesses`

Todos los endpoints devuelven JSON con campo `success: boolean`.

> **Persistencia (Sprint 2):** con `DATABASE_URL` configurada (Neon
> PostgreSQL + PostGIS) las consultas usan índices GIST (`bbox &&`,
> `ST_DWithin`, `ST_Distance`). Sin la variable, la API cae a un fallback
> in-memory con el seed — idéntico comportamiento para desarrollo. Ver
> `db/schema.sql`, `db/seed.sql` y `docs/roadmap.md`.

---

## `GET /api/businesses`

Lista negocios con filtros, radio de búsqueda y orden por distancia.

### Query params

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `bbox` | `w,s,e,n` | — | Viewport: solo negocios dentro del envelope (Sprint 3) |
| `lat` | number | — | Latitud del origen (habilita distancia + radius) |
| `lng` | number | — | Longitud del origen |
| `radius` | number (m) | — | Radio máximo estilo `ST_DWithin` (ej. `2000` = 2 km) |
| `province` | string | `all` | Nombre exacto de provincia (ej. `La Habana`) |
| `municipality` | string | `all` | Nombre exacto de municipio |
| `category` | string | `all` | Slug de categoría (ej. `tiendas`, `restaurantes`) |
| `transfer` | `true`/`false` | — | `true` = solo `acceptsTransfer` |
| `activeNow` | `true`/`false` | — | `true` = solo `transferActiveNow` |
| `verification` | string | `all` | `verified` \| `pending` \| `reported` |
| `q` | string | — | Búsqueda de texto (name, description, address, municipality, neighborhood) |
| `limit` | number | `500` | Máximo 500 por respuesta |

### Orden
- Con `lat`+`lng`: ascendente por distancia (Haversine; `ST_DDistance` en
  producción).
- Sin coordenadas: `featured` primero, luego `rating` desc.

### Ejemplo

```bash
curl "http://localhost:3000/api/businesses?province=La%20Habana&activeNow=true&lat=23.1385&lng=-82.3842&radius=3000"
```

```json
{
  "success": true,
  "total": 2,
  "businesses": [
    {
      "id": "tc-biz-001",
      "name": "Cafetería El Vedado",
      "distanceMeters": 812.4,
      "...": "..."
    }
  ]
}
```

---

## `POST /api/businesses`

Registra un negocio. Nace con `status: 'pending'` y `transferVerified: false`
(requiere aprobación admin).

### Body (campos opcionales, con defaults)

```json
{
  "name": "Mi Negocio",
  "category": "tiendas",
  "categoryIcon": "🏪",
  "description": "Descripción corta",
  "province": "La Habana",
  "municipality": "Playa",
  "neighborhood": "Miramar",
  "address": "Calle 5ta esq. 42",
  "lat": 23.1136,
  "lng": -82.3666,
  "acceptsTransfer": true,
  "transferActiveNow": true,
  "transferDetails": {
    "transfermovil": true,
    "enzona": false,
    "qrPayment": false,
    "onlineGateway": false,
    "cash": true
  },
  "hours": "9:00 AM - 6:00 PM",
  "whatsapp": "+53 5xxxxxxx",
  "phone": "+53 7xxxxxxx",
  "photos": ["https://..."]
}
```

### Respuesta: `201 Created` con el `Business` creado.

---

## `PATCH /api/businesses`

Acciona sobre un negocio existente. Solo un action por request.

### Body

```json
{ "id": "tc-biz-001", "action": "verify", "payload": { "verified": true } }
```

### Actions

| Action | Efecto | Payload |
|---|---|---|
| `verify` | Toggle/forzar `transferVerified` + recalcular status | `{ verified?: boolean }` |
| `approve` | status → `active` + verificado (admin) | — |
| `reject` | status → `rejected` (admin) | — |
| `delete` | Elimina el negocio | — |
| `toggleTransferActive` | Alterna `transferActiveNow` | — |
| `vote` | +1 confirmación o +1 reporte | `{ isConfirm: boolean }` |
| `report` | +1 `reportsCount` | — |

### Respuestas

- `200` con el `Business` actualizado.
- `400` si falta `id` o body inválido.
- `404` si el negocio no existe.

### Ejemplo

```bash
curl -X PATCH http://localhost:3000/api/businesses \
  -H "Content-Type: application/json" \
  -d '{"id":"tc-biz-001","action":"vote","payload":{"isConfirm":true}}'
```

---

# Autenticación de usuarios — `/api/account/*`

Registro/login/cierre de sesión de usuarios reales (identidad teléfono + PIN,
Fase 0). Namespace separado de la auth admin (`/api/auth/*`). Cookie de
sesión HttpOnly `tc_session` (30 días). BD caída → `503` (sin fallback).

| Endpoint | Método | Respuestas |
|---|---|---|
| `/api/account/register` | POST | `201` + `{ success, user }` y cookie |
| `/api/account/login` | POST | `200` + `{ success, user }` y cookie; `401` teléfono/PIN incorrectos; `403` cuenta bloqueada |
| `/api/account/me` | GET | `{ authenticated, user? }` |
| `/api/account/logout` | POST | `{ success }`; revoca sesión y borra cookie |

`user` público: `{ id, phone, name, role, status }`.

### Registro

```json
POST /api/account/register
{ "name": "Ana Pérez", "phone": "5355551234", "pin": "1234" }
```

- Errores comunes: `400` (validación), `409` (teléfono ya registrado,
  incluida la carrera de doble registro → UNIQUE 23505).

### Login / me / logout

```bash
curl -X POST http://localhost:3000/api/account/login \
  -H "Content-Type: application/json" -c cookies.txt \
  -d '{"phone":"5355551234","pin":"1234"}'
curl -b cookies.txt http://localhost:3000/api/account/me
curl -b cookies.txt -X POST http://localhost:3000/api/account/logout
```

---

# API REST — `/api/deliveries` (Fase 2-3)

Base URL (dev): `http://localhost:3000/api/deliveries`

Todos los endpoints devuelven JSON con campo `success: boolean`.
Autenticación vía cookie `tc_session` (ver sección `/api/account/*`).

---

## `GET /api/deliveries/estimate`

Estima precio y distancia de una carrera sin crearla.

**Rol:** USER | BUSINESS | ADMIN  
**Params (query):** `fromLat` (requerido), `fromLng` (requerido), `toLat` (requerido), `toLng` (requerido).  
**Respuesta 200:**
```json
{
  "success": true,
  "distanceMeters": 4451,
  "distanceKm": 4.5,
  "durationMin": 8,
  "totalFareCup": 273,
  "breakdown": {
    "baseCup": 200,
    "paidKm": 1.45,
    "details": [{"label": "5 km", "km": 1.45, "rate": 50}]
  }
}
```
**Errores:** 400 (coords faltantes/inválidas), 401, 502 (OSRM cae), 503.

---

## `POST /api/deliveries`

Crea una carrera. La ruta OSRM se calcula **una vez** aquí (write-time) y se
persiste para que la vista recurrente no la recalcule.

**Rol:** USER | BUSINESS | ADMIN  
**Body:**
```json
{
  "packageType": "comida",            // documento|comida|medicina|paquete|generic
  "packageNote": "dos pizzas",        // opcional, máx 300 chars
  "fragile": true,                    // opcional, default false
  "payableOnDelivery": true,          // opcional, default false
  "pickup": {
    "lat": 23.1136,
    "lng": -82.3666,
    "address": "Av 5ta y 42",
    "note": "piso 2"                  // opcional
  },
  "dropoff": {
    "lat": 23.1385,
    "lng": -82.3842,
    "address": "Calle 18 esq 3ra",
    "note": null                      // opcional
  }
}
```
**Respuesta 201:** `{ success: true, delivery: <DeliveryDTO> }` (con `includeLocations: true, includeRequester: true`).  
**Errores:** 400 (JSON inválido, tipo paquete, coords, dirección), 401, 502 (OSRM falla), 503.

---

## `GET /api/deliveries`

Historial de carreras **según rol** (últimas 30).

**Rol:** USER | BUSINESS | ADMIN | MESSENGER
- Solicitante (USER/BUSINESS/ADMIN) → su historial de carreras propias.
- MESSENGER → carreras que le han sido **asignadas** (todas sus filas), con
  locations + requester + messenger.
**Respuesta 200:** `{ success: true, deliveries: [<DeliveryDTO>] }` (completo: locations + requester + messenger).

---

## `GET /api/deliveries/[id]`

Detalle de una carrera con filtrado por rol.

**Rol:** solicitante | admin | mensajero asignado  
**Filtrado:**
- Solicitante / admin → DTO completo.
- Mensajero asignado (cuando status ≠ PENDING) → DTO completo.
- Cualquier otro → 403.

**Respuesta 200:** `{ success: true, delivery: <DeliveryDTO> }`  
**Errores:** 401, 403, 404, 503.

---

## `GET /api/deliveries/available`

Carreras PENDING disponibles para mensajeros. Sin dirección de entrega ni
identidad del solicitante; solo pickup + distancia + tarifa + datos de paquete.

**Rol:** MESSENGER (exclusivo)  
**Respuesta 200:**
```json
{
  "success": true,
  "deliveries": [{
    "id": "...", "code": "TC-XXX",
    "status": "PENDING", "packageType": "comida",
    "distanceKm": 4.5, "durationMin": 8, "totalFareCup": 273,
    "requestedAt": "2026-...",
    "pickup": { "lat": 23.1, "lng": -82.3, "address": "...", "note": null }
  }]
}
```
**Errores:** 401, 403 (no es MESSENGER), 503.

---

## `PATCH /api/deliveries/[id]`

Acciones del ciclo de vida de una carrera.

**Rol:** varía por acción (ver tabla)  
**Body:** `{ "action": "...", "note?" }`  
**Acciones:**

| action | Rol | De → A | Guard |
|---|---|---|---|
| `accept` | MESSENGER | PENDING → ACCEPTED | Perfil ACTIVE requerido; doble accept → 409 |
| `pick_up` | MESSENGER (asignado) | ACCEPTED → PICKED_UP | — |
| `in_transit` | MESSENGER (asignado) | PICKED_UP → IN_TRANSIT | — |
| `deliver` | MESSENGER (asignado) | IN_TRANSIT → DELIVERED | — |
| `cancel` | solicitante (PENDING) / admin (activos) | → CANCELLED | motivo en `note` |
| `trust` | solicitante | DELIVERED → trust | solo una vez; si no es DELIVERED → 400 |

**Respuesta exitosa (200):** `{ success: true, delivery: <DeliveryDTO> }` (completo: locations + requester + messenger).  
**Errores:** 400 (acción inválida), 401, 403 (rol/perfil), 404, 409 (transición inválida), 503.

---

## DeliveryDTO

Estructura pública de una carrera (campos condicionales por opciones):

```json
{
  "id": "uuid", "code": "TC-XXXXX", "status": "PENDING",
  "packageType": "comida", "packageNote": "dos pizzas",
  "fragile": false, "payableOnDelivery": true,
  "pickup": { "lat": 23.1, "lng": -82.3, "address": "...", "note": null },
  "dropoff": { "lat": 23.1, "lng": -82.3, "address": "...", "note": null },
  "distanceKm": 4.5, "durationMin": 8, "totalFareCup": 273,
  "requestedAt": "2026-...", "respondedAt": null,
  "pickedUpAt": null, "deliveredAt": null, "cancelledAt": null,
  "updatedAt": "2026-...",
  "trustedBy": null, "trustedAt": null,
  "requester": { "id": "uuid", "name": "Walker" },
  "messenger": null
}
```

**Ejemplo curl completo (crear + aceptar):**
```bash
# login
curl -c jar.txt -b jar.txt -X POST http://localhost:3000/api/account/login \
  -H 'Content-Type: application/json' -d '{"phone":"5355551234","pin":"1234"}'

# estimar
curl -b jar.txt 'http://localhost:3000/api/deliveries/estimate?fromLat=23.11&fromLng=-82.37&toLat=23.14&toLng=-82.38'

# crear carrera
curl -b jar.txt -X POST http://localhost:3000/api/deliveries \
  -H 'Content-Type: application/json' \
  -d '{"packageType":"comida","packageNote":"pizza","payableOnDelivery":true,"pickup":{"lat":23.11,"lng":-82.37,"address":"Centro"},"dropoff":{"lat":23.14,"lng":-82.38,"address":"Vedado"}}'

# historial
curl -b jar.txt http://localhost:3000/api/deliveries

# ver disponibles (requiere MESSENGER)
curl -b jar-mensajero.txt http://localhost:3000/api/deliveries/available

# aceptar carrera (requiere MESSENGER + perfil ACTIVE)
curl -b jar-mensajero.txt -X PATCH http://localhost:3000/api/deliveries/UUID \
  -H 'Content-Type: application/json' -d '{"action":"accept"}'
```

---

## Fase 6: historial, valoraciones y eventos en vivo

> Backend implementado en commits `94c1d2a` y `c5f2eca`. UI integrada en commit
> `b8dcc54`.

| Endpoint | Método | Rol | Comportamiento |
|---|---|---|---|
| `/api/deliveries/history` | GET | USER/BUSINESS/ADMIN, MESSENGER | Paginado con cursor opaco `(requested_at, id)`. `limit` 1–50 (30 por defecto), `status` opcional. Role-aware: USER/BUSINESS ven lo que pidieron, MESSENGER lo asignado, ADMIN todo. Respuesta `{ deliveries, nextCursor }`. |
| `/api/deliveries/[id]/reviews` | GET | quien puede ver la carrera | Valoraciones visibles; `hidden`/`removed` solo para ADMIN. |
| `/api/deliveries/[id]/reviews` | POST | solicitante | 201 / 400 puntuación o comentario / 403 no es suya o no entregada / 404 / 409 ya valorada / 503. |
| `/api/admin/deliveries/reviews/[reviewId]` | PATCH | admin | `hide`, `restore`, `remove`. `remove` es lógico: la fila se conserva. |
| `/api/messengers/[userId]/stats` | GET | el propio mensajero o admin | `{ rating, reviewCount, completedOrders }`. |
| `/api/deliveries/stream` | GET | USER/BUSINESS/ADMIN, MESSENGER | SSE autenticado. Heartbeat cada 15 s, eventos `delivery.status` con `Last-Event-ID`. Fallback a polling si SSE no soportado. |
