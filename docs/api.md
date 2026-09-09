# API REST — `/api/businesses`

Base URL (dev): `http://localhost:3000/api/businesses`

Todos los endpoints devuelven JSON con campo `success: boolean`.

> **Nota:** el store es in-memory (se reinicia con el server). Diseñado para
> reemplazarse por PostgreSQL/PostGIS.

---

## `GET /api/businesses`

Lista negocios con filtros, radio de búsqueda y orden por distancia.

### Query params

| Param | Tipo | Default | Descripción |
|---|---|---|---|
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
