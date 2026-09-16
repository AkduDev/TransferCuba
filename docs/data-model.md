# Modelo de datos — TransferCuba

Definido en `lib/cuba-data.ts`.

## `Business`

```ts
interface Business {
  id: string;                  // ej. "tc-biz-1694298000000"
  name: string;
  category: string;            // slug de CATEGORIES
  categoryIcon: string;        // emoji
  description: string;
  province: string;           // nombre de CUBAN_PROVINCES
  municipality: string;
  neighborhood?: string;
  address: string;
  lat: number;
  lng: number;
  acceptsTransfer: boolean;    // acepta transferencia en general
  transferActiveNow: boolean; // 🟢 activa en este momento
  transferDetails: {
    transfermovil: boolean;
    enzona: boolean;
    qrPayment: boolean;
    onlineGateway: boolean;
    cash: boolean;
  };
  transferVerified: boolean;   // verificado por el equipo
  lastStatusUpdate: string;   // "Hace 15 min"
  lastUpdatedDate: string;     // ISO date
  confirmationsCount: number;  // 👍
  reportsCount: number;       // 👎
  userConfirmedRecently?: boolean;
  hours: string;
  whatsapp: string;
  phone: string;
  rating: number;
  reviewsCount: number;
  photos: string[];
  featured: boolean;
  status: 'active' | 'pending' | 'rejected';
  distanceMeters?: number;    // calculado contra userLocation
}
```

## Categorías (`CATEGORIES`)

| id | Label |
|---|---|
| `comida` | Comida & Restaurantes |
| `tiendas` | Tiendas & Mercados |
| `farmacias` | Farmacias & Salud |
| `cafeterias` | Cafeterías & Panaderías |
| `servicios` | Servicios & Celulares |
| `ferreteria` | Ferretería & Hogar |
| `ropa` | Ropa & Calzado |

## Provincias (`CUBAN_PROVINCES`)

15 provincias con `center: [lat, lng]`, `zoom` y lista de municipios:
La Habana, Santiago de Cuba, Holguín, Matanzas, Villa Clara, y resto del país.
Ver fuente para el detalle.

## Estados de verificación (derivados)

Un negocio se considera:
- **verified**: `transferVerified === true` y `reportsCount === 0`
- **reported**: `reportsCount > 0`
- **pending**: el resto

## Ciclo de vida de `status`

```
             registro (POST / registro UI)
                   │
                   ▼
              ┌─────────┐
              │ pending │ (oculto del mapa)
              └────┬────┘
        admin aprobar │ admin rechazar
         ┌────────────┴────────────┐
         ▼                         ▼
   ┌─────────┐               ┌──────────┐
   │ active  │ (visible)     │ rejected │ (oculto)
   └─────────┘               └──────────┘
```

- `active` es requisito para aparecer en mapa y listas (filtro #0 de
  `filteredBusinesses` en `page.tsx`).
- `AdminDashboardModal` ejecuta aprobar/rechazar; `verify` puede reactivar.

## Geolocalización

- `calculateDistanceMeters()` — Haversine entre dos puntos (simula
  `ST_Distance` de PostGIS).
- `formatDistance()` — "850 m" / "2.3 km".
- Rutas: `lib/osrm.ts` → distancia/tiempo reales de conducción vía OSRM.
- Geocoding: `lib/nominatim.ts` → search + reverse, limitado a Cuba
  (`countrycodes=cu`).

## Identidad (Fase 0 — módulo mensajería)

Definido en `db/migrate_auth.sql`, accedido vía `lib/db-auth.ts`.

- **`users`**: `id uuid`, `phone text UNIQUE` (normalizado, 7-15 dígitos),
  `name`, `pin_hash` (scrypt con sal, 4-8 dígitos), `role`
  (`USER|BUSINESS|MESSENGER|ADMIN`, defecto `USER`), `status`
  (`active|blocked`), `created_at`, `last_login_at`.
- **`sessions`**: `id uuid`, `user_id FK → users ON DELETE CASCADE`,
  `created_at`, `expires_at` (30 días), `revoked_at`.
- **`businesses.owner_user_id`**: FK opcional → `users (ON DELETE SET NULL)`;
  vincula un negocio registrado a su dueño de cuenta.

Sin identidad no se puede pedir servicios de delivery; es la base del módulo
de mensajería (ver `docs/messaging-module.md`).

## Delivery (Fase 1 — módulo mensajería)

Definido en `db/migrate_delivery.sql`, DAO en `lib/db-delivery.ts`.

- **`pricing_config`** (singleton): tramos de tarifa por km (`base`, `free_km`,
  tarifas 3-5 / 5-10 / 10+ km).
- **`platform_config`** (singleton): alta pagada de mensajeros
  (`messenger_fee_cup`, `messenger_pay_card`, `messenger_whatsapp`).
- **`messengers_profiles`**: perfil operativo del mensajero (UNIQUE
  `user_id`), `status PENDING|ACTIVE|SUSPENDED`, `vehicle`, `service_areas[]`.
- **`delivery_requests`**: carrera con `code TC-XXXXX` UNIQUE, `status`
  (CHECK), `requester_id` / `messenger_id`, paquete, pickup/dropoff, ruta y
  tarifas cacheadas, timestamps por evento. Índice parcial en `PENDING`.
- **`delivery_status_events`**: auditoría de transiciones.
- **`messengers_payments`**: ledger del alta (`PENDING|PAID|CONFIRMED|REJECTED`).

Transiciones regidas por `ALLOWED_TRANSITIONS` (PENDING→ACCEPTED/CANCELLED/
EXPIRED; ACCEPTED→PICKED_UP/CANCELLED; PICKED_UP→IN_TRANSIT;
IN_TRANSIT→DELIVERED; terminales el resto). Expiración lazy a 15 min.
