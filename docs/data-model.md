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
- **`messengers_payments`**: ledger del alta y las renovaciones
  (`PENDING|PAID|CONFIRMED|REJECTED`), con `method` (`efectivo|transferencia`),
  `kind` (`alta|renovacion`) y `covers_days`.

### Suscripción del mensajero

Ser mensajero **caduca**. El importe y el periodo los fija administración en
`platform_config`; por defecto **300 CUP cada 30 días**.

| Columna | Tabla | Para qué |
|---|---|---|
| `messenger_fee_cup` | `platform_config` | Importe del alta y de cada renovación |
| `messenger_period_days` | `platform_config` | Días que otorga un pago confirmado (1–365) |
| `expires_at` | `messengers_profiles` | Fin de la suscripción; `NULL` = nunca activada |
| `method` | `messengers_payments` | `efectivo` o `transferencia` |
| `kind` | `messengers_payments` | `alta` la primera vez, `renovacion` después |
| `covers_days` | `messengers_payments` | Periodo congelado al crear el pago |

Reglas:

- **Operar exige dos condiciones independientes**: perfil `ACTIVE` (decisión de
  administración) **y** `expires_at > now()` (el reloj). `SUSPENDED` no se
  arregla pagando, y pagar no levanta una suspensión.
- **Al confirmar un pago**, `expires_at = GREATEST(expires_at, now()) + covers_days`.
  Quien renueva antes de vencer **suma** los días que le quedaban; quien renueva
  tarde arranca desde hoy.
- **El importe y el periodo se congelan** en la fila del pago al crearlo: si
  administración cambia la tarifa entre que el mensajero paga y que se confirma,
  vale lo que había cuando pagó.
- **Vencer no degrada la cuenta**: conserva el rol `MESSENGER`, el perfil y el
  historial. Solo pierde el tablón y la posibilidad de aceptar carreras nuevas.
  Una carrera **ya aceptada** se puede terminar: cortarla dejaría el paquete de
  un cliente a medio camino.
- **Rechazar una renovación** no toca el rol ni el perfil; el mensajero sigue con
  los días que ya tenía. Rechazar un **alta** sí devuelve la cuenta a `USER`.
- El `kind` lo decide el **servidor** mirando el perfil, nunca el cliente.

### Próxima fase — valoraciones de entrega

La Fase 6 añade `delivery_reviews` para valorar al mensajero después de una entrega:

```sql
CREATE TABLE IF NOT EXISTS delivery_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, requester_id)
);
```

Solo el solicitante de una carrera `DELIVERED` puede crear la valoración. El backend
verifica ownership, estado terminal y unicidad; administración puede ocultar,
restaurar o eliminar lógicamente el registro. `messengers_profiles.rating` y
`completed_orders` son cachés derivadas de `delivery_reviews` y `delivery_requests`.
La especificación completa de la Fase 6 se mantiene fuera del repositorio, como
documento local de trabajo.

Transiciones regidas por `ALLOWED_TRANSITIONS` (PENDING→ACCEPTED/CANCELLED/
EXPIRED; ACCEPTED→PICKED_UP/CANCELLED; PICKED_UP→IN_TRANSIT;
IN_TRANSIT→DELIVERED; terminales el resto). Expiración lazy a 15 min.
