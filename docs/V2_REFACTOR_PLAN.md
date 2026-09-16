# Plan de Refactorización TransferCuba V2

## Diagnóstico consolidado

| Área | Estado | Acción requerida |
|------|--------|------------------|
| Next.js / React | 🟢 | Sin cambios estructurales |
| MapLibre | 🟢 | Refactorizar, no reescribir |
| PostGIS | 🟢 | Base sólida, preparar MVT futuro |
| Neon | 🟢 | Adecuado, sin cambios |
| Modelo de datos | 🔴 | Separar responsabilidades de `businesses` |
| Índices | 🔴 | Eliminar duplicados, agregar faltantes |
| API | 🟡 | Separar endpoints, agregar validación |
| Persistencia | 🔴 | Fallo DB → 503 en producción |
| Arquitectura frontend | 🟡 | Dividir `page.tsx` en hooks/componentes |
| Validación | 🔴 | Inputs no validados, defaults peligrosos |
| Seguridad | 🟡 | Revisar permisos de mutaciones |

---

## 📅 Fase 0: Limpieza inmediata (sin cambios de esquema)

**Objetivo:** Corregir problemas de integridad sin riesgo de migración.

### 0.1 Eliminar índices duplicados
```sql
-- Duplicados detectados:
DROP INDEX IF EXISTS idx_businesses_geom;           -- duplica businesses_geom_gist
DROP INDEX IF EXISTS idx_businesses_status_prov_mun; -- duplica businesses_status_province_municipality
DROP INDEX IF EXISTS idx_businesses_status_category; -- duplica businesses_status_category
DROP INDEX IF EXISTS idx_businesses_rating;          -- 0 scans, no es prioritario

-- Mantener:
-- businesses_pkey (primary key)
-- businesses_geom_gist (GIST sobre geography)
-- businesses_status_province_municipality
-- businesses_status_category
-- businesses_active_now (WHERE status = 'active')
```

### 0.2 Eliminar segunda query de coordenadas en `queryBusinesses`
**Archivo:** `lib/db.ts`

Cambiar:
```typescript
// ANTES: dos queries
const res = await pool.query(`${select} ${where} ${order} ${limit}`, params);
const coords = await pool.query(`SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM businesses WHERE id = ANY($1)`, [ids]);

// DESPUÉS: una sola query
const select = `
  SELECT 
    id, name, category, category_icon, description,
    province, municipality, neighborhood, address,
    whatsapp, phone, hours,
    transfer_details, accepts_transfer, transfer_active_now, transfer_verified,
    status, confirmations_count, reports_count, rating, reviews_count,
    featured, photos,
    last_status_update, last_updated_date, created_at,
    ST_X(geom::geometry) AS lng,
    ST_Y(geom::geometry) AS lat,
    ${hasOrigin ? `ST_Distance(geom, ST_GeomFromText(${originParam}, 4326)::geography) AS distance_meters` : 'NULL::double precision AS distance_meters'}
  FROM businesses
`;
```

### 0.3 Comportamiento DB failure según entorno
**Archivo:** `lib/db.ts`

```typescript
// DESARROLLO: fallback a memoria (ya existe)
if (process.env.NODE_ENV === 'development') {
  memoryEnsure().unshift({ ...b });
  return;
}

// PRODUCCIÓN: error explícito
throw new Error('Database unavailable');
```

**Archivo:** `app/api/businesses/route.ts`

```typescript
try {
  await insertBusiness(newBusiness);
  return NextResponse.json({ success: true, business: newBusiness }, { status: 201 });
} catch (err) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }
  // Desarrollo: still failing to memory
  return NextResponse.json({ success: true, business: newBusiness }, { status: 201 });
}
```

### 0.4 Eliminar `SELECT *` del GET
**Archivo:** `app/api/businesses/route.ts`

```typescript
// ANTES
const res = await pool.query(`SELECT *, ...`);

// DESPUÉS: campos explícitos
const fields = `
  id, name, category, category_icon, description,
  province, municipality, neighborhood, address,
  whatsapp, phone, hours,
  transfer_details, accepts_transfer, transfer_active_now, transfer_verified,
  status, confirmations_count, reports_count, rating, reviews_count,
  featured, photos,
  last_status_update, last_updated_date, created_at,
  ST_X(geom::geometry) AS lng,
  ST_Y(geom::geometry) AS lat
`;
```

### 0.5 Validación básica de inputs
**Archivo:** `app/api/businesses/route.ts` (POST)

```typescript
// Validar coordenadas
if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90) {
  return NextResponse.json({ error: 'Invalid latitude' }, { status: 400 });
}
if (typeof body.lng !== 'number' || body.lng < -180 || body.lng > 180) {
  return NextResponse.json({ error: 'Invalid longitude' }, { status: 400 });
}

// Validar campos requeridos
if (!body.name || typeof body.name !== 'string' || body.name.length < 3) {
  return NextResponse.json({ error: 'Name required (min 3 chars)' }, { status: 400 });
}
if (!body.category) {
  return NextResponse.json({ error: 'Category required' }, { status: 400 });
}
```

### 0.6 ID: cambiar de `Date.now()` a UUID
**Archivo:** `lib/db.ts` (businessToInsert)

```typescript
import { v4 as uuidv4 } from 'uuid';

const businessToInsert = (b: Business) => [
  b.id || uuidv4(),  // Si no tiene ID, generar UUID
  // ... resto igual
];
```

**Archivo:** `app/api/businesses/route.ts` (POST)

```typescript
const newBusiness: Business = {
  id: crypto.randomUUID(),  // Nativo de Node 18+
  // ... resto igual
};
```

### 0.7 Borrar fallback a `INITIAL_BUSINESSES` en producción
**Archivo:** `app/page.tsx`

```typescript
// DESARROLLO: usar seed
if (process.env.NODE_ENV === 'development') {
  setBusinesses(INITIAL_BUSINESSES);
}

// PRODUCCIÓN: array vacío, esperar API
// (ya está manejado por el sync effect)
```

---

## 📅 Fase 1: Modelo de datos V2

**Objetivo:** Preparar esquema para crecimiento sin perder datos existentes.

### 1.1 Migrar `photos` JSONB a tabla separada
```sql
-- Nueva tabla
CREATE TABLE business_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  alt TEXT,
  sort_order INTEGER DEFAULT 0,
  is_cover BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrar datos existentes
INSERT INTO business_images (business_id, url, sort_order)
SELECT id, jsonb_array_elements_text(photos), ordinality
FROM businesses, jsonb_array_elements_text(photos) WITH ORDINALITY
WHERE photos != '[]'::jsonb;

-- Eliminar columna de businesses
ALTER TABLE businesses DROP COLUMN photos;
```

### 1.2 Migrar `hours` text a tabla normalizada
```sql
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME,
  closes_at TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  UNIQUE(business_id, day_of_week)
);

-- Insertar horarios por defecto (lunes-viernes 8:30-18:00)
INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at)
SELECT id, generate_series(0, 5), '08:30'::time, '18:00'::time
FROM businesses;
```

### 1.3 Extraer `transfer_details` a tabla de métodos de pago
```sql
-- Catálogo de métodos de pago
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  active BOOLEAN DEFAULT TRUE
);

INSERT INTO payment_methods (name, slug, icon) VALUES
  ('Transfermóvil', 'transfermovil', 'Smartphone'),
  ('EnZona', 'enzona', 'Zap'),
  ('QR', 'qr', 'QrCode'),
  ('Efectivo', 'cash', 'Banknote'),
  ('Pago online', 'onlineGateway', 'CreditCard');

-- Relación negocio-método
CREATE TABLE business_payment_methods (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (business_id, payment_method_id)
);

-- Migrar datos
INSERT INTO business_payment_methods (business_id, payment_method_id, is_active)
SELECT 
  b.id,
  pm.id,
  (b.transfer_details ->> pm.slug)::boolean
FROM businesses b
JOIN payment_methods pm ON true
WHERE b.transfer_details ? pm.slug;

-- Eliminar columna de businesses
ALTER TABLE businesses DROP COLUMN transfer_details;
```

### 1.4 Tabla de reportes (separar de `reports_count`)
```sql
CREATE TABLE business_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_session TEXT,  -- o user_id si hay auth
  reason TEXT NOT NULL,  -- 'spam', 'closed', 'misleading', 'other'
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Eliminar reports_count de businesses (calcular bajo demanda)
ALTER TABLE businesses DROP COLUMN reports_count;
```

### 1.5 Tabla de verificaciones
```sql
CREATE TABLE business_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_session TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- verificación válida por X meses
  UNIQUE(business_id, user_session)
);

-- Mantener transfer_verified como cache
-- Se actualiza cuando business_verifications tiene registros válidos
```

### 1.6 Tabla de confirmaciones
```sql
CREATE TABLE business_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_session TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, user_session, created_at::date)  -- 1 por día
);

-- Eliminar confirmations_count (calcular bajo demanda)
ALTER TABLE businesses DROP COLUMN confirmations_count;
```

### 1.7 Tabla de reviews (futuro)
```sql
CREATE TABLE business_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID,  -- o user_session para anónimo
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eliminar rating y reviews_count de businesses (calcular bajo demanda)
ALTER TABLE businesses DROP COLUMN rating;
ALTER TABLE businesses DROP COLUMN reviews_count;
```

### 1.8 Tabla de promociones (featured → promociones)
```sql
CREATE TABLE business_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('featured', 'sponsored', 'promo')),
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrar featured existente
INSERT INTO business_promotions (business_id, type, active)
SELECT id, 'featured', true FROM businesses WHERE featured = true;

-- Eliminar featured de businesses
ALTER TABLE businesses DROP COLUMN featured;
```

### 1.9 Esquema final simplificado de businesses
```sql
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  category_icon TEXT DEFAULT '🏪',
  description TEXT DEFAULT '',
  province TEXT NOT NULL,
  municipality TEXT NOT NULL,
  neighborhood TEXT,
  address TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  accepts_transfer BOOLEAN DEFAULT TRUE,
  transfer_active_now BOOLEAN DEFAULT TRUE,
  transfer_verified BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'active', 'suspended', 'archived')),
  last_status_update TEXT DEFAULT 'Registrado recientemente',
  last_updated_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  geom geography(Point, 4326)
);

-- Índices necesarios
CREATE INDEX businesses_geom_gist ON businesses USING GIST (geom);
CREATE INDEX businesses_status ON businesses (status);
CREATE INDEX businesses_category ON businesses (category);
CREATE INDEX businesses_province ON businesses (province);
CREATE INDEX businesses_active_now ON businesses (transfer_active_now) WHERE status = 'active';
```

---

## 📅 Fase 2: DTOs y API versionada

**Objetivo:** Separar consulta de comando, endpoints específicos por dominio.

### 2.1 Crear DTOs

**Archivo:** `lib/dto.ts`

```typescript
// DTO para el mapa (payload mínimo)
export interface MapBusiness {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  transferActiveNow: boolean;
  transferVerified: boolean;
  featured: boolean;  // derivado de promotions
}

// DTO para detalles del negocio
export interface BusinessDetails {
  id: string;
  name: string;
  description: string;
  address: string;
  province: string;
  municipality: string;
  neighborhood: string;
  whatsapp: string;
  phone: string;
  hours: BusinessHour[];
  images: BusinessImage[];
  paymentMethods: PaymentMethod[];
  status: string;
  averageRating: number;
  reviewsCount: number;
  confirmationsCount: number;
  reportsCount: number;
}

export interface BusinessHour {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface BusinessImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  sortOrder: number;
  isCover: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  isActive: boolean;
}
```

### 2.2 Separar endpoints

```
GET    /api/businesses                    → MapBusiness[] (map view)
GET    /api/businesses/[id]               → BusinessDetails
POST   /api/businesses                    → CreateBusiness
PATCH  /api/businesses/[id]               → UpdateBusiness
DELETE /api/businesses/[id]               → SoftDelete (status → archived)

POST   /api/businesses/[id]/confirmations → CreateConfirmation
POST   /api/businesses/[id]/reports       → CreateReport
POST   /api/businesses/[id]/reviews       → CreateReview
POST   /api/businesses/[id]/verify        → CreateVerification

GET    /api/admin/businesses              → AdminBusiness[] (includes all statuses)
PATCH  /api/admin/businesses/[id]         → AdminUpdate (approve, reject, suspend)
```

### 2.3 Query optimizada para mapa

```typescript
// lib/queries/mapBusinesses.ts
export async function getMapBusinesses(filters: MapFilters): Promise<MapBusiness[]> {
  const sql = `
    SELECT 
      b.id,
      b.name,
      b.category,
      ST_X(b.geom::geometry) AS lng,
      ST_Y(b.geom::geometry) AS lat,
      b.transfer_active_now,
      b.transfer_verified,
      EXISTS (
        SELECT 1 FROM business_promotions bp 
        WHERE bp.business_id = b.id 
        AND bp.type = 'featured' 
        AND bp.active = true
        AND (bp.expires_at IS NULL OR bp.expires_at > NOW())
      ) AS featured
    FROM businesses b
    WHERE b.status = 'active'
    ${filters.bbox ? `AND b.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)` : ''}
    ${filters.category ? `AND b.category = $5` : ''}
    LIMIT $6
  `;
  // ...
}
```

---

## 📅 Fase 3: Frontend refactor

**Objetivo:** Dividir `page.tsx` en hooks y componentes responsables.

### 3.1 Hooks personalizados

```typescript
// hooks/useBusinesses.ts
export function useBusinesses(filters: BusinessFilters) {
  const [businesses, setBusinesses] = useState<MapBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchBusinesses = async () => {
      const params = buildSearchParams(filters);
      const res = await fetch(`/api/businesses?${params}`);
      const data = await res.json();
      setBusinesses(data.businesses);
      setLoading(false);
    };
    fetchBusinesses();
  }, [filters]);
  
  return { businesses, loading };
}

// hooks/useMapViewport.ts
export function useMapViewport() {
  const [viewport, setViewport] = useState({
    center: [-82.38, 23.14] as [number, number],
    zoom: 14,
    bbox: null as [number, number, number, number] | null
  });
  
  const handleMoveEnd = useCallback((newViewport) => {
    setViewport(newViewport);
  }, []);
  
  return { viewport, handleMoveEnd };
}

// hooks/useBusinessFilters.ts
export function useBusinessFilters() {
  const [filters, setFilters] = useState<BusinessFilters>({
    province: 'all',
    municipality: 'all',
    category: 'all',
    onlyTransfer: true
  });
  
  return { filters, setFilters };
}
```

### 3.2 Componentes extraídos

```
components/
├── map/
│   ├── MapView.tsx           # Contenedor principal del mapa
│   ├── MapControls.tsx       # Botones de zoom, geolocalización
│   ├── MapMarkers.tsx        # Marcadores y clusters
│   └── MapPopups.tsx         # Popups de negocio
├── business/
│   ├── BusinessCard.tsx      # Card en el mapa/lista
│   ├── BusinessDetails.tsx   # Panel de detalles
│   ├── BusinessGallery.tsx   # Galería de fotos
│   └── BusinessHours.tsx     # Horarios
├── search/
│   ├── SearchBar.tsx         # Barra de búsqueda
│   └── SearchResults.tsx     # Resultados
├── filters/
│   ├── FilterPanel.tsx       # Panel de filtros
│   └── CategoryFilter.tsx    # Filtro por categoría
├── admin/
│   ├── AdminDashboard.tsx    # Dashboard admin
│   └── AdminBusinessList.tsx # Lista de negocios admin
└── registration/
    ├── RegistrationForm.tsx  # Formulario de registro
    └── RegistrationSuccess.tsx # Confirmación
```

### 3.3 Page.tsx refactorizado

```typescript
// app/page.tsx
export default function Home() {
  const { businesses, loading } = useBusinesses(filters);
  const { viewport, handleMoveEnd } = useMapViewport();
  const { filters, setFilters } = useBusinessFilters();
  
  return (
    <main>
      <MapView 
        businesses={businesses}
        viewport={viewport}
        onMoveEnd={handleMoveEnd}
      />
      <FilterPanel 
        filters={filters}
        onFilterChange={setFilters}
      />
      {loading && <LoadingSpinner />}
    </main>
  );
}
```

---

## 📅 Fase 4: Preparación MVT (futuro)

**Objetivo:** Habilitar vector tiles para escalabilidad del mapa.

### 4.1 Extensiones PostgreSQL necesarias
```sql
CREATE EXTENSION IF NOT EXISTS pg_tileserv;
-- o
CREATE EXTENSION IF NOT EXISTS pg_tiler;
```

### 4.2 Función para generar MVT
```sql
CREATE OR REPLACE FUNCTION get_businesses_mvt(
  bbox geometry,
  z integer
) RETURNS bytea AS $$
DECLARE
  result bytea;
BEGIN
  SELECT ST_AsMVT(q, 'businesses', 4096, 'geom')
  INTO result
  FROM (
    SELECT 
      id,
      name,
      category,
      ST_AsMVTGeom(geom, bbox, 4096, 256, true) AS geom
    FROM businesses
    WHERE geom && bbox
    AND status = 'active'
  ) q;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 API para MVT
```typescript
// app/api/tiles/[z]/[x]/[y]/route.ts
export async function GET(req: NextRequest) {
  const { z, x, y } = getParams(req);
  const bbox = tileToBbox(z, x, y);
  
  const result = await pool.query(
    'SELECT get_businesses_mvt($1, $2) AS mvt',
    [bbox, z]
  );
  
  return new Response(result.rows[0].mvt, {
    headers: { 'Content-Type': 'application/vnd.mapbox-vector-tile' }
  });
}
```

---

## 📅 Fase 5: Validación con Zod

**Objetivo:** Validación robusta de todos los inputs.

### 5.1 Esquemas Zod

```typescript
// lib/validations.ts
import { z } from 'zod';

export const CreateBusinessSchema = z.object({
  name: z.string().min(3).max(200),
  category: z.enum(['tiendas', 'comida', 'farmacias', 'cafeterias', 'servicios', 'ferreteria', 'ropa']),
  description: z.string().max(1000),
  province: z.string().min(1),
  municipality: z.string().min(1),
  neighborhood: z.string().optional(),
  address: z.string().min(1),
  whatsapp: z.string().regex(/^\+?[0-9]+$/).optional(),
  phone: z.string().regex(/^\+?[0-9]+$/).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  acceptsTransfer: z.boolean(),
  transferActiveNow: z.boolean(),
});

export const CreateReportSchema = z.object({
  reason: z.enum(['spam', 'closed', 'misleading', 'other']),
  description: z.string().max(500).optional(),
});

export const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
```

### 5.2 Uso en API

```typescript
// app/api/businesses/route.ts
import { CreateBusinessSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const result = CreateBusinessSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }
  
  // Usar result.data en lugar de body
  const newBusiness = await createBusiness(result.data);
  return NextResponse.json({ success: true, business: newBusiness });
}
```

---

## 📅 Orden de implementación

### Sprint 1: Limpieza (Fase 0)
- [ ] Eliminar índices duplicados (0.1)
- [ ] Fusionar queries en `queryBusinesses` (0.2)
- [ ] Comportamiento DB failure por entorno (0.3)
- [ ] Eliminar `SELECT *` del GET (0.4)
- [ ] Validación básica de inputs (0.5)
- [ ] ID: `Date.now()` → UUID (0.6)
- [ ] Borrar fallback `INITIAL_BUSINESSES` en producción (0.7)
- **Duración estimada:** 2-3 horas
- **Riesgo:** Bajo (sin cambios de esquema)

### Sprint 2: Modelo V2 (Fase 1)
- [ ] Tabla `business_images` (1.1)
- [ ] Tabla `business_hours` (1.2)
- [ ] Tabla `payment_methods` + `business_payment_methods` (1.3)
- [ ] Tabla `business_reports` (1.4)
- [ ] Tabla `business_verifications` (1.5)
- [ ] Tabla `business_confirmations` (1.6)
- [ ] Tabla `business_reviews` (1.7)
- [ ] Tabla `business_promotions` (1.8)
- [ ] Simplificar `businesses` (1.9)
- **Duración estimada:** 4-6 horas
- **Riesgo:** Medio (requiere migración de datos)

### Sprint 3: API v2 (Fase 2)
- [ ] Crear DTOs (2.1)
- [ ] Separar endpoints (2.2)
- [ ] Query optimizada para mapa (2.3)
- [ ] Validación con Zod (Fase 5)
- **Duración estimada:** 3-4 horas
- **Riesgo:** Medio

### Sprint 4: Frontend refactor (Fase 3)
- [ ] Hooks personalizados (3.1)
- [ ] Componentes extraídos (3.2)
- [ ] Page.tsx refactorizado (3.3)
- **Duración estimada:** 4-6 horas
- **Riesgo:** Bajo (sin cambios de API)

### Sprint 5: MVT (Fase 4)
- [ ] Extensiones PostgreSQL (4.1)
- [ ] Función MVT (4.2)
- [ ] API tiles (4.3)
- **Duración estimada:** 2-3 horas
- **Riesgo:** Bajo (adicional, no rompe nada)

---

## 📊 Métricas de éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Tamaño de `page.tsx` | ~1200 líneas | <200 líneas |
| Queries por request | 2 | 1 |
| Tamaño payload mapa | ~2KB | ~500B |
| Validación de inputs | Ninguna | Completa |
| Fallback DB producción | Silencioso | 503 explícito |
| Tabla businesses | 19 columnas | 12 columnas |
| Tablas totales | 1 | 9 |
| Índices duplicados | 4 | 0 |

---

## 🎯 Resumen ejecutivo

**NO hacer:**
- Reescribir MapLibre
- Cambiar Neon o PostGIS
- Rediseñar la UI completa

**SÍ hacer:**
1. Limpiar integridad (índices, validación, errores explícitos)
2. Normalizar modelo de datos (9 tablas en lugar de 1)
3. Separar API (endpoints específicos, DTOs, validación)
4. Dividir frontend (hooks, componentes, page.tsx mínimo)
5. Preparar para MVT (sin implementar aún)

**Orden:** Fase 0 → 1 → 2 → 3 → 4 → 5

**Tiempo estimado total:** 15-22 horas

**Riesgo general:** Bajo (migraciones incrementales con datos existentes)

---

*Documento generado el: 2026-09-16*
*Última actualización: 2026-09-16*
