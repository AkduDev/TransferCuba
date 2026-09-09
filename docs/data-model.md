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
