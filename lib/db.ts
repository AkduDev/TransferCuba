/**
 * TransferCuba — acceso a datos (PostgreSQL + PostGIS).
 *
 * Estrategia Sprint 2 (docs/roadmap.md):
 *  - Producción: Neon serverless Postgres con PostGIS (DATABASE_URL).
 *  - Desarrollo sin DATABASE_URL: fallback in-memory con el seed original,
 *    idéntico en forma de fila, para que la app funcione local sin infra.
 *
 * Geocoding write-time: lat/lng se resuelven una sola vez al registrar
 * (Nominatim) y se persisten como geography(Point, 4326) aquí.
 */

import { Pool } from 'pg';
import { INITIAL_BUSINESSES, calculateDistanceMeters } from '@/lib/cuba-data';
import type { Business } from '@/lib/cuba-data';
import type {
  MapBusiness,
  BusinessDetails,
  BusinessHour,
  BusinessImage,
  PaymentMethod,
  BusinessPromotion
} from '@/lib/dto';

export interface BusinessFilters {
  bbox?: [number, number, number, number]; // [west, south, east, north]
  lat?: number;
  lng?: number;
  radius?: number; // meters
  province?: string;
  municipality?: string;
  category?: string;
  activeNow?: boolean;
  onlyTransfer?: boolean;
  qr?: boolean;
  online?: boolean;
  verification?: 'verified' | 'pending' | 'reported' | 'all';
  includeAll?: boolean; // admin: no filtrar por status
  q?: string;
  limit?: number;
}

type Row = {
  id: string;
  name: string;
  category: string;
  category_icon: string;
  description: string;
  province: string;
  municipality: string;
  neighborhood: string | null;
  address: string;
  whatsapp: string;
  phone: string;
  hours: string;
  transfer_details_v2?: Record<string, boolean> | null;
  accepts_transfer: boolean;
  transfer_active_now: boolean;
  transfer_verified: boolean;
  status: Business['status'];
  confirmations_count: number;
  reports_count: number;
  rating: string | number;
  reviews_count: number;
  featured: boolean;
  photos: string[];
  last_status_update: string;
  last_updated_date: Date;
  distance_meters?: number;
};

const poolOrNull = (): Pool | null => {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // Neon requiere TLS; conexiones locales (sin sslmode) quedan tal cual.
  const needsSsl = /neon\.tech|sslmode=require/.test(url) && !/sslmode=disable/.test(url);
  return new Pool({
    connectionString: url,
    max: 5,
    // Conexiones vivas más tiempo: evita rehacer el handshake TLS a Neon
    // (~1s RTT) en cada request si pasan >10s entre una y otra.
    idleTimeoutMillis: 60_000,
    // Tiempos acotados: redes restrictivas pueden bloquear el TLS a 5432 y
    // dejar el intento colgado si no hay límite (Sprint 10 — circuit breaker).
    connectionTimeoutMillis: 5_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined
  });
};

let poolRef: Pool | null | undefined;

function getPool(): Pool | null {
  if (poolRef === undefined) poolRef = poolOrNull();
  return poolRef;
}

export function isDbConfigured(): boolean {
  return getPool() !== null;
}

/* ---------------- circuit breaker (Sprint 10) ---------------- */

// En desarrollo sin BD (o con red bloqueada) el fallback in-memory mantiene
// la app usable. En producción el fallback silencioso ocultaría errores
// reales (un POST que "confirma" un negocio que nunca se guardó): aquí la
// DB es la única verdad y hay que fallar de forma visible (HTTP 503).
const isProduction = process.env.NODE_ENV === 'production';

// True cuando, tras un fallo de BD, la capa superior puede seguir con memoria.
function canFallbackToMemory(): boolean {
  return !isProduction;
}

// Si la BD es inalcanzable (p.ej. red que bloquea el TLS a 5432 de Neon),
// cada request esperaría el timeout del pool antes de caer al fallback.
// El breaker abre el circuito durante DB_RETRY_MS para que el desarrollo
// responda inmediato desde memoria, y se rearma solo para reintentar.
const DB_RETRY_MS = 60_000;

let dbUnavailableUntil = 0;

function shouldAttemptDb(): boolean {
  return Date.now() >= dbUnavailableUntil;
}

function markDbUnavailable(err: unknown): void {
  if (dbUnavailableUntil <= Date.now()) {
    console.error(
      '[db] PostgreSQL inalcanzable; usando fallback in-memory y reintentando en 60s:',
      (err as Error)?.message ?? err
    );
  }
  dbUnavailableUntil = Date.now() + DB_RETRY_MS;
}

function markDbAvailable(): void {
  dbUnavailableUntil = 0;
}

/* ---------------- conversión fila ⇄ dominio ---------------- */

/**
 * Sprint 5 (Cuba-first): descarta fotos de CDNs externos (unsplash/picsum).
 * En Cuba esos dominios suelen ser lentos o inaccesibles; el placeholder
 * local por categoría es siempre más rápido.
 */
const EXTERNAL_PHOTO_PATTERN = /unsplash|picsum|pexels|shutterstock/i;

export function sanitizePhotos(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  return photos.filter(
    (p): p is string => typeof p === 'string' && !EXTERNAL_PHOTO_PATTERN.test(p)
  );
}

function rowToBusiness(r: Row): Business {
  // V2: transferDetails se reconstruye desde business_payment_methods.
  // (La columna legacy transfer_details se eliminó — Sprint 3 / 1.9.)
  const tdV2 = r.transfer_details_v2 as Record<string, boolean> | null | undefined;
  const transferDetails = {
    transfermovil: tdV2?.transfermovil === true,
    enzona: tdV2?.enzona === true,
    qrPayment: tdV2?.qr === true,
    onlineGateway: tdV2?.onlineGateway === true,
    cash: tdV2?.cash === true
  };

  return {
    id: r.id,
    name: r.name,
    category: r.category,
    categoryIcon: r.category_icon,
    description: r.description,
    province: r.province,
    municipality: r.municipality,
    neighborhood: r.neighborhood ?? undefined,
    address: r.address,
    lat: 0,
    lng: 0,
    acceptsTransfer: r.accepts_transfer,
    transferActiveNow: r.transfer_active_now,
    transferDetails,
    transferVerified: r.transfer_verified,
    lastStatusUpdate: r.last_status_update,
    lastUpdatedDate: new Date(r.last_updated_date).toISOString(),
    confirmationsCount: r.confirmations_count,
    reportsCount: r.reports_count,
    userConfirmedRecently: undefined,
    hours: r.hours,
    whatsapp: r.whatsapp,
    phone: r.phone,
    rating: Number(r.rating),
    reviewsCount: r.reviews_count,
    photos: sanitizePhotos(r.photos),
    featured: r.featured,
    status: r.status,
    ...(r.distance_meters !== undefined && r.distance_meters !== null
      ? { distanceMeters: Math.round(Number(r.distance_meters)) }
      : {})
  };
}

const businessToInsert = (b: Business) => [
  b.id || crypto.randomUUID(),
  b.name,
  b.category,
  b.categoryIcon,
  b.description,
  b.province,
  b.municipality,
  b.neighborhood ?? null,
  b.address,
  b.whatsapp,
  b.phone,
  b.hours,
  b.acceptsTransfer,
  b.transferActiveNow,
  b.transferVerified,
  b.status,
  b.confirmationsCount,
  b.reportsCount,
  b.rating,
  b.reviewsCount,
  b.lastStatusUpdate,
  b.lat,
  b.lng
];

const INSERT_SQL = `
  INSERT INTO businesses (
    id, name, category, category_icon, description, province, municipality,
    neighborhood, address, whatsapp, phone, hours,
    accepts_transfer, transfer_active_now, transfer_verified, status,
    confirmations_count, reports_count, rating, reviews_count,
    last_status_update, geom
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
    $21, ST_SetSRID(ST_MakePoint($23, $22), 4326)::geography
  )
  ON CONFLICT (id) DO NOTHING
`;

/* ---------------- fallback in-memory (dev sin DATABASE_URL) ---------------- */

const memoryState = (): Business[] => INITIAL_BUSINESSES.map((b) => ({ ...b }));

let memoryBusinesses: Business[] | null = null;

function memoryEnsure(): Business[] {
  if (!memoryBusinesses) memoryBusinesses = memoryState();
  return memoryBusinesses;
}

function memoryFilter(filters: BusinessFilters): Business[] {
  let result = memoryEnsure().filter((b) =>
    filters.includeAll ? true : b.status === 'active'
  );

  if (filters.province && filters.province !== 'all') {
    result = result.filter(
      (b) => b.province.toLowerCase() === filters.province!.toLowerCase()
    );
  }
  if (filters.municipality && filters.municipality !== 'all') {
    result = result.filter(
      (b) => b.municipality.toLowerCase() === filters.municipality!.toLowerCase()
    );
  }
  if (filters.category && filters.category !== 'all') {
    result = result.filter((b) => b.category === filters.category);
  }
  if (filters.onlyTransfer) result = result.filter((b) => b.acceptsTransfer);
  if (filters.activeNow) result = result.filter((b) => b.transferActiveNow);
  if (filters.qr) result = result.filter((b) => b.transferDetails?.qrPayment);
  if (filters.online) result = result.filter((b) => b.transferDetails?.onlineGateway);
  if (filters.verification && filters.verification !== 'all') {
    result = result.filter((b) => {
      const isReported = b.reportsCount > 0;
      const isVerified = b.transferVerified && !isReported;
      const isPending = !isVerified && !isReported;
      if (filters.verification === 'verified') return isVerified;
      if (filters.verification === 'pending') return isPending;
      return isReported;
    });
  }
  if (filters.q?.trim()) {
    const q = filters.q.toLowerCase().trim();
    result = result.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        b.municipality.toLowerCase().includes(q) ||
        (b.neighborhood && b.neighborhood.toLowerCase().includes(q))
    );
  }
  // bbox aproximado (suficiente para dev)
  if (filters.bbox) {
    const [w, s, e, n] = filters.bbox;
    result = result.filter((b) => b.lng >= w && b.lng <= e && b.lat >= s && b.lat <= n);
  }

  if (filters.lat !== undefined && filters.lng !== undefined) {
    result = result.map((b) => ({
      ...b,
      distanceMeters: calculateDistanceMeters(filters.lat!, filters.lng!, b.lat, b.lng)
    }));
    if (filters.radius) {
      result = result.filter((b) => (b.distanceMeters ?? 0) <= filters.radius!);
    }
    result.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  } else {
    result.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return b.rating - a.rating;
    });
  }

  return result.slice(0, filters.limit ?? 500);
}

/* ---------------- API pública ---------------- */

// Construcción del WHERE (filtros + espaciales), compartida por la query
// completa (Business[]) y la ligera de mapa (MapBusiness[]).
function buildBusinessesWhere(filters: BusinessFilters) {
  const where: string[] = filters.includeAll ? [] : [`b.status = 'active'`];
  const params: unknown[] = [];
  let p = 0;
  const next = (v: unknown) => {
    params.push(v);
    return `$${++p}`;
  };

  if (filters.province && filters.province !== 'all')
    where.push(`b.province ILIKE ${next(filters.province)}`);
  if (filters.municipality && filters.municipality !== 'all')
    where.push(`b.municipality ILIKE ${next(filters.municipality)}`);
  if (filters.category && filters.category !== 'all')
    where.push(`b.category = ${next(filters.category)}`);
  if (filters.onlyTransfer) where.push(`b.accepts_transfer = TRUE`);
  if (filters.activeNow) where.push(`b.transfer_active_now = TRUE`);
  // Sprint 3 (V2): los métodos de pago viven en business_payment_methods.
  if (filters.qr)
    where.push(
      `EXISTS (SELECT 1 FROM business_payment_methods bpm
               JOIN payment_methods pm ON pm.id = bpm.payment_method_id
               WHERE bpm.business_id = b.id AND pm.slug = 'qr' AND bpm.is_active)`
    );
  if (filters.online)
    where.push(
      `EXISTS (SELECT 1 FROM business_payment_methods bpm
               JOIN payment_methods pm ON pm.id = bpm.payment_method_id
               WHERE bpm.business_id = b.id AND pm.slug = 'onlineGateway' AND bpm.is_active)`
    );
  if (!filters.includeAll && filters.verification && filters.verification !== 'all') {
    const v = next(filters.verification);
    where.push(
      `(CASE WHEN (SELECT COUNT(*) FROM business_reports br WHERE br.business_id = b.id AND status = 'pending') > 0 THEN 'reported'
             WHEN EXISTS (SELECT 1 FROM business_verifications bv WHERE bv.business_id = b.id
                          AND (bv.expires_at IS NULL OR bv.expires_at > NOW())) THEN 'verified'
             ELSE 'pending' END) = ${v}`
    );
  }
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    const l = next(like);
    where.push(
      `(b.name ILIKE ${l} OR b.description ILIKE ${l} OR b.address ILIKE ${l}
        OR b.municipality ILIKE ${l} OR b.neighborhood ILIKE ${l})`
    );
  }

  // Spatial: viewport bbox (&& envelope) y/u origen+radio (ST_DWithin)
  const hasOrigin = filters.lat !== undefined && filters.lng !== undefined;
  const originParam = hasOrigin ? next(`POINT(${filters.lng} ${filters.lat})`) : null;

  if (filters.bbox) {
    const [w, s, e, n] = filters.bbox;
    where.push(
      `b.geom && ST_MakeEnvelope(${next(w)}, ${next(s)}, ${next(e)}, ${next(n)}, 4326)`
    );
  }
  if (hasOrigin && filters.radius) {
    where.push(
      `ST_DWithin(b.geom, ST_GeomFromText(${originParam}, 4326)::geography, ${next(filters.radius)})`
    );
  }

  return { where, params, hasOrigin, originParam };
}

export async function queryBusinesses(filters: BusinessFilters): Promise<Business[]> {
  const pool = getPool();
  if (!pool || !shouldAttemptDb()) return memoryFilter(filters);

  const { where, params, hasOrigin, originParam } = buildBusinessesWhere(filters);
  const emptyWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const select = `SELECT b.id, b.name, b.category, b.category_icon, b.description, b.province, b.municipality,
    b.neighborhood, b.address, b.whatsapp, b.phone, b.hours,
    b.accepts_transfer, b.transfer_active_now, b.transfer_verified, b.status,
    b.confirmations_count, b.reports_count, b.rating, b.reviews_count,
    b.last_status_update, b.last_updated_date,
    -- V2: featured deriva de business_promotions (columna legacy eliminada en 1.9)
    COALESCE(
      (SELECT bp.active FROM business_promotions bp
       WHERE bp.business_id = b.id AND bp.type = 'featured'
       AND (bp.ends_at IS NULL OR bp.ends_at > NOW())
       ORDER BY bp.priority DESC LIMIT 1),
      FALSE
    ) AS featured,
    -- V2: transferDetails se reconstruye desde business_payment_methods
    (SELECT COALESCE(jsonb_object_agg(pm.slug, true), '{}'::jsonb)
     FROM business_payment_methods bpm JOIN payment_methods pm ON pm.id = bpm.payment_method_id
     WHERE bpm.business_id = b.id AND bpm.is_active) AS transfer_details_v2,
    ${
    hasOrigin
      ? `ST_Distance(b.geom, ST_GeomFromText(${originParam}, 4326)::geography) AS distance_meters`
      : 'NULL::double precision AS distance_meters'
  },
    ST_X(b.geom::geometry) AS lng, ST_Y(b.geom::geometry) AS lat
  FROM businesses b`;

  const orderBy = hasOrigin
    ? `ORDER BY distance_meters ASC NULLS LAST`
    : `ORDER BY featured DESC, b.rating DESC`;
  const limit = `$${params.length + 1}`;
  params.push(filters.limit ?? 500);

  const sql = `${select} ${emptyWhere} ${orderBy} LIMIT ${limit}`;

  try {
    const res = await pool.query(sql, params);
    // lng/lat vienen ya del geometry (una sola query, sin rehidratación)
    markDbAvailable();
    return res.rows.map((r: Row & { lng: number; lat: number }) => ({
      ...rowToBusiness(r),
      lat: r.lat,
      lng: r.lng
    }));
  } catch (err) {
    markDbUnavailable(err);
    if (canFallbackToMemory()) return memoryFilter(filters);
    throw new Error('Database unavailable');
  }
}

// Payload mínimo para el mapa (DTO MapBusiness): solo lo que dibujan pins y
// clústeres. El detalle completo se sirve bajo demanda por GET /api/businesses/[id].
// Fase 2.1 (V2_REFACTOR_PLAN.md): el mapa no necesita el Business entero.
export async function queryBusinessesMap(filters: BusinessFilters): Promise<MapBusiness[]> {
  const pool = getPool();

  const fromMemory = (): MapBusiness[] =>
    memoryFilter(filters).map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      lat: b.lat,
      lng: b.lng,
      transferActiveNow: b.transferActiveNow,
      transferVerified: b.transferVerified,
      featured: b.featured
    }));

  if (!pool || !shouldAttemptDb()) return fromMemory();

  const { where, params, hasOrigin, originParam } = buildBusinessesWhere(filters);
  const emptyWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const select = `SELECT b.id, b.name, b.category,
    COALESCE(
      (SELECT bp.active FROM business_promotions bp
       WHERE bp.business_id = b.id AND bp.type = 'featured'
       AND (bp.ends_at IS NULL OR bp.ends_at > NOW())
       ORDER BY bp.priority DESC LIMIT 1),
      FALSE
    ) AS featured,
    b.transfer_active_now,
    b.transfer_verified,
    ${
    hasOrigin
      ? `ST_Distance(b.geom, ST_GeomFromText(${originParam}, 4326)::geography) AS distance_meters`
      : 'NULL::double precision AS distance_meters'
  },
    ST_X(b.geom::geometry) AS lng, ST_Y(b.geom::geometry) AS lat
  FROM businesses b`;

  const orderBy = hasOrigin
    ? `ORDER BY distance_meters ASC NULLS LAST`
    : `ORDER BY featured DESC, b.rating DESC`;
  const limit = `$${params.length + 1}`;
  params.push(filters.limit ?? 500);

  const sql = `${select} ${emptyWhere} ${orderBy} LIMIT ${limit}`;

  try {
    const res = await pool.query(sql, params);
    markDbAvailable();
    return res.rows.map(
      (r): MapBusiness => ({
        id: r.id,
        name: r.name,
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        transferActiveNow: r.transfer_active_now,
        transferVerified: r.transfer_verified,
        featured: r.featured
      })
    );
  } catch (err) {
    markDbUnavailable(err);
    if (canFallbackToMemory()) return fromMemory();
    throw new Error('Database unavailable');
  }
}

export async function insertBusiness(b: Business): Promise<void> {
  const pool = getPool();
  if (!pool || !shouldAttemptDb()) {
    if (canFallbackToMemory()) {
      memoryEnsure().unshift({ ...b });
      return;
    }
    throw new Error('Database unavailable');
  }
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(INSERT_SQL, businessToInsert(b));
      await insertV2Details(client, b);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    markDbAvailable();
  } catch (err) {
    markDbUnavailable(err);
    if (!canFallbackToMemory()) throw new Error('Database unavailable');
    memoryEnsure().unshift({ ...b });
  }
}

// V2 (Sprint 3): mantiene las tablas normalizadas sincronizadas con la columna
// legacy (que el frontend aún consume). Métodos de pago, promoción featured,
// verificación seed y horario estándar.
async function insertV2Details(
  client: import('pg').PoolClient,
  b: Business
): Promise<void> {
  // Métodos de pago: mapear transferDetails → slugs de payment_methods ('qr' ← qrPayment)
  const slugs: Record<string, boolean> = {
    transfermovil: b.transferDetails.transfermovil,
    enzona: b.transferDetails.enzona,
    qr: b.transferDetails.qrPayment,
    onlineGateway: b.transferDetails.onlineGateway,
    cash: b.transferDetails.cash
  };
  for (const [slug, isActive] of Object.entries(slugs)) {
    if (!isActive) continue;
    await client.query(
      `INSERT INTO business_payment_methods (business_id, payment_method_id)
       SELECT $1::text, id FROM payment_methods WHERE slug = $2::text
       ON CONFLICT (business_id, payment_method_id) DO NOTHING`,
      [b.id, slug]
    );
  }

  if (b.featured) {
    await client.query(
      `INSERT INTO business_promotions (business_id, type, active)
       VALUES ($1, 'featured', TRUE)
       ON CONFLICT DO NOTHING`,
      [b.id]
    );
  }

  if (b.transferVerified) {
    await client.query(
      `INSERT INTO business_verifications (business_id, user_session, expires_at)
       VALUES ($1, 'seed', NOW() + INTERVAL '12 months')
       ON CONFLICT (business_id, user_session) DO NOTHING`,
      [b.id]
    );
  }

  await client.query(
    `INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at)
     SELECT $1::text, dow, '08:30'::time, '18:00'::time
     FROM generate_series(0, 6) AS dow
     ON CONFLICT (business_id, day_of_week) DO NOTHING`,
    [b.id]
  );

  // Fotos subidas a Cloudinary → business_images
  if (b.photos.length > 0) {
    for (let i = 0; i < b.photos.length; i++) {
      const url = b.photos[i];
      if (typeof url !== 'string' || !url) continue;
      await client.query(
        `INSERT INTO business_images (id, business_id, url, alt, sort_order, is_cover)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [b.id, url, null, i, i === 0]
      );
    }
  }
}

export type PatchAction =
  | 'verify'
  | 'toggleTransferActive'
  | 'vote'
  | 'report'
  | 'approve'
  | 'reject'
  | 'delete';

export async function patchBusiness(
  id: string,
  action: PatchAction,
  payload?: { verified?: boolean; isConfirm?: boolean }
): Promise<Business | null> {
  const pool = getPool();

  const applyInMemory = (): Business | null => {
    const list = memoryEnsure();
    const idx = list.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const b = list[idx];
    if (action === 'delete') {
      list.splice(idx, 1);
      return null;
    }
    if (action === 'verify') {
      b.transferVerified = payload?.verified ?? !b.transferVerified;
      b.status = b.transferVerified ? 'active' : 'pending';
      b.lastStatusUpdate = 'Verificado por TransferCuba';
    } else if (action === 'approve') {
      b.status = 'active';
      b.transferVerified = true;
      b.lastStatusUpdate = 'Aprobado y publicado por administración';
    } else if (action === 'reject') {
      b.status = 'rejected';
      b.lastStatusUpdate = 'Rechazado por administración';
    } else if (action === 'toggleTransferActive') {
      b.transferActiveNow = !b.transferActiveNow;
      b.lastStatusUpdate = 'Hace un momento';
    } else if (action === 'vote') {
      if (payload?.isConfirm) b.confirmationsCount += 1;
      else b.reportsCount += 1;
      b.lastStatusUpdate = 'Confirmado por la comunidad hoy';
    } else if (action === 'report') {
      b.reportsCount += 1;
      b.lastStatusUpdate = 'Reportado por usuario';
    }
    return { ...b };
  };

  if (!pool || !shouldAttemptDb()) {
    if (canFallbackToMemory()) return applyInMemory();
    throw new Error('Database unavailable');
  }

  const updates: Record<PatchAction, string> = {
    verify: `UPDATE businesses SET
      transfer_verified = COALESCE($2, NOT transfer_verified),
      status = CASE WHEN COALESCE($2, NOT transfer_verified) THEN 'active' ELSE 'pending' END,
      last_status_update = 'Verificado por TransferCuba'
    WHERE id = $1 RETURNING id`,
    approve: `UPDATE businesses SET
      status = 'active', transfer_verified = TRUE,
      last_status_update = 'Aprobado y publicado por administración'
    WHERE id = $1 RETURNING id`,
    reject: `UPDATE businesses SET
      status = 'rejected',
      last_status_update = 'Rechazado por administración'
    WHERE id = $1 RETURNING id`,
    toggleTransferActive: `UPDATE businesses SET
      transfer_active_now = NOT transfer_active_now,
      last_status_update = 'Hace un momento'
    WHERE id = $1 RETURNING id`,
    vote: `UPDATE businesses SET
      confirmations_count = confirmations_count + CASE WHEN $2 THEN 1 ELSE 0 END,
      reports_count = reports_count + CASE WHEN $2 THEN 0 ELSE 1 END,
      last_status_update = 'Confirmado por la comunidad hoy'
    WHERE id = $1 RETURNING id`,
    report: `UPDATE businesses SET
      reports_count = reports_count + 1,
      last_status_update = 'Reportado por usuario'
    WHERE id = $1 RETURNING id`,
    delete: `DELETE FROM businesses WHERE id = $1 RETURNING id`
  };

  try {
    // Solo vote/verify usan el segundo parámetro; el resto espera exactamente 1
    const params = action === 'vote' ? [id, payload?.isConfirm ?? null] : [id];

    // V2 (Sprint 3): las acciones de comunidad escriben su fila en la tabla
    // normalizada (business_confirmations / business_reports / verifications)
    // además del contador legacy que el frontend aún consume.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (action === 'vote') {
        await client.query(
          `INSERT INTO business_confirmations (business_id, user_session)
           VALUES ($1, COALESCE($2, 'public'))`,
          [id, payload?.isConfirm ? 'public-confirm' : null]
        );
        if (!payload?.isConfirm) {
          await client.query(
            `INSERT INTO business_reports (business_id, reason)
             VALUES ($1, 'other')`,
            [id]
          );
        }
      } else if (action === 'report') {
        await client.query(
          `INSERT INTO business_reports (business_id, reason)
           VALUES ($1, 'other')`,
          [id]
        );
      } else if (action === 'verify' || action === 'approve') {
        await client.query(
          `INSERT INTO business_verifications (business_id, user_session, expires_at)
           VALUES ($1, 'admin', NOW() + INTERVAL '12 months')
           ON CONFLICT (business_id, user_session) DO NOTHING`,
          [id]
        );
      }
      const res = await client.query(updates[action], params);
      await client.query('COMMIT');
      if (!res.rows.length) return null;
      if (action === 'delete') return null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const fetched = await queryBusinessesByIds([id]);
    markDbAvailable();
    return fetched.get(id) ?? null;
  } catch (err) {
    markDbUnavailable(err);
    if (canFallbackToMemory()) return applyInMemory();
    throw new Error('Database unavailable');
  }
}

export async function queryBusinessesByIds(ids: string[]): Promise<Map<string, Business>> {
  const pool = getPool();

  const fromMemory = (): Map<string, Business> => {
    const map = new Map<string, Business>();
    memoryEnsure().forEach((b) => {
      if (ids.includes(b.id)) map.set(b.id, b);
    });
    return map;
  };

  if (!pool || !shouldAttemptDb()) {
    if (canFallbackToMemory()) return fromMemory();
    throw new Error('Database unavailable');
  }
  try {
    const res = await pool.query(
      `SELECT b.id, b.name, b.category, b.category_icon, b.description, b.province, b.municipality,
        b.neighborhood, b.address, b.whatsapp, b.phone, b.hours,
        b.accepts_transfer, b.transfer_active_now, b.transfer_verified, b.status,
        b.confirmations_count, b.reports_count, b.rating, b.reviews_count,
        b.last_status_update, b.last_updated_date,
        COALESCE(
          (SELECT bp.active FROM business_promotions bp
           WHERE bp.business_id = b.id AND bp.type = 'featured'
           AND (bp.ends_at IS NULL OR bp.ends_at > NOW())
           ORDER BY bp.priority DESC LIMIT 1),
          FALSE
        ) AS featured,
        COALESCE(
          (SELECT ARRAY(SELECT url FROM business_images bi
            WHERE bi.business_id = b.id ORDER BY bi.sort_order)),
          ARRAY[]::text[]
        ) AS photos,
        (SELECT COALESCE(jsonb_object_agg(pm.slug, true), '{}'::jsonb)
         FROM business_payment_methods bpm JOIN payment_methods pm ON pm.id = bpm.payment_method_id
         WHERE bpm.business_id = b.id AND bpm.is_active) AS transfer_details_v2,
        NULL::double precision AS distance_meters,
        ST_X(b.geom::geometry) AS lng, ST_Y(b.geom::geometry) AS lat
       FROM businesses b WHERE b.id = ANY($1::text[])`,
      [ids]
    );
    const map = new Map<string, Business>();
    res.rows.forEach((r: Row & { lng: number; lat: number }) => {
      map.set(r.id, { ...rowToBusiness(r), lat: r.lat, lng: r.lng });
    });
    markDbAvailable();
    return map;
  } catch (err) {
    markDbUnavailable(err);
    if (canFallbackToMemory()) return fromMemory();
    throw new Error('Database unavailable');
  }
}

// Sprint 3 (V2): detalle completo de un negocio (DTO BusinessDetails) con
// agregados de las tablas normalizadas. Usado por GET /api/businesses/[id].
export async function queryBusinessDetails(id: string): Promise<BusinessDetails | null> {
  const pool = getPool();
  if (!pool || !shouldAttemptDb()) {
    if (!canFallbackToMemory()) throw new Error('Database unavailable');
    const b = memoryEnsure().find((x) => x.id === id);
    return b ? legacyToDetails(b) : null;
  }

  try {
    const [bizRes, hoursRes, imagesRes, paysRes, promosRes, statsRes] = await Promise.all([
      pool.query(
        `SELECT b.id, b.name, b.description, b.address, b.province, b.municipality,
                b.neighborhood, b.whatsapp, b.phone, b.status,
                b.transfer_active_now, b.transfer_verified, b.accepts_transfer,
                b.last_updated_date
         FROM businesses b WHERE b.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT day_of_week, opens_at, closes_at, is_closed
         FROM business_hours WHERE business_id = $1 ORDER BY day_of_week`,
        [id]
      ),
      pool.query(
        `SELECT id, url, thumbnail_url, alt, sort_order, is_cover
         FROM business_images WHERE business_id = $1 ORDER BY sort_order`,
        [id]
      ),
      pool.query(
        `SELECT pm.id, pm.name, pm.slug, pm.icon, bpm.is_active
         FROM business_payment_methods bpm
         JOIN payment_methods pm ON pm.id = bpm.payment_method_id
         WHERE bpm.business_id = $1 ORDER BY pm.name`,
        [id]
      ),
      pool.query(
        `SELECT type, active FROM business_promotions
         WHERE business_id = $1 AND (ends_at IS NULL OR ends_at > NOW())
         ORDER BY priority DESC`,
        [id]
      ),
      pool.query(
        `SELECT
           COALESCE(
             (SELECT COUNT(*) FROM business_confirmations WHERE business_id = $1),
             b.confirmations_count::bigint
           )::int AS confirmations_count,
           COALESCE(
             (SELECT COUNT(*) FROM business_reports WHERE business_id = $1 AND status = 'pending'),
             b.reports_count::bigint
           )::int AS reports_count,
           CASE WHEN EXISTS (
             SELECT 1 FROM business_reviews WHERE business_id = $1 AND status = 'active'
           ) THEN (SELECT ROUND(AVG(rating), 1) FROM business_reviews
                   WHERE business_id = $1 AND status = 'active')::float
             ELSE b.rating::float END AS average_rating,
           CASE WHEN EXISTS (
             SELECT 1 FROM business_reviews WHERE business_id = $1 AND status = 'active'
           ) THEN (SELECT COUNT(*) FROM business_reviews
                   WHERE business_id = $1 AND status = 'active')::int
             ELSE b.reviews_count END AS reviews_count
         FROM businesses b WHERE b.id = $1`,
        [id]
      )
    ]);

    const b = bizRes.rows[0];
    if (!b) return null;

    markDbAvailable();
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      address: b.address,
      province: b.province,
      municipality: b.municipality,
      neighborhood: b.neighborhood,
      whatsapp: b.whatsapp ?? '',
      phone: b.phone ?? '',
      hours: hoursRes.rows.map(
        (h: { day_of_week: number; opens_at: string | null; closes_at: string | null; is_closed: boolean }): BusinessHour => ({
          dayOfWeek: h.day_of_week,
          opensAt: h.opens_at ? h.opens_at.slice(0, 5) : null,
          closesAt: h.closes_at ? h.closes_at.slice(0, 5) : null,
          isClosed: h.is_closed
        })
      ),
      images: imagesRes.rows.map(
        (i): BusinessImage => ({
          id: i.id,
          url: i.url,
          thumbnailUrl: i.thumbnail_url,
          alt: i.alt,
          sortOrder: i.sort_order,
          isCover: i.is_cover
        })
      ),
      paymentMethods: paysRes.rows.map(
        (p): PaymentMethod => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          icon: p.icon,
          isActive: p.is_active
        })
      ),
      promotions: promosRes.rows.map(
        (pr): BusinessPromotion => ({ type: pr.type, active: pr.active })
      ),
      status: b.status,
      transferActiveNow: b.transfer_active_now,
      transferVerified: b.transfer_verified,
      acceptsTransfer: b.accepts_transfer,
      averageRating: statsRes.rows[0].average_rating,
      reviewsCount: statsRes.rows[0].reviews_count,
      confirmationsCount: statsRes.rows[0].confirmations_count,
      reportsCount: statsRes.rows[0].reports_count,
      createdAt: b.last_updated_date
        ? new Date(b.last_updated_date).toISOString()
        : new Date(0).toISOString(),
      updatedAt: b.last_updated_date
        ? new Date(b.last_updated_date).toISOString()
        : new Date(0).toISOString()
    };
  } catch (err) {
    markDbUnavailable(err);
    if (canFallbackToMemory()) {
      const b = memoryEnsure().find((x) => x.id === id);
      return b ? legacyToDetails(b) : null;
    }
    throw new Error('Database unavailable');
  }
}

// Fallback dev: construye BusinessDetails desde el Business en memoria.
function legacyToDetails(b: Business): BusinessDetails {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    address: b.address,
    province: b.province,
    municipality: b.municipality,
    neighborhood: b.neighborhood ?? null,
    whatsapp: b.whatsapp,
    phone: b.phone,
    hours: [],
    images: [],
    paymentMethods: [
      { id: 'transfermovil', name: 'Transfermóvil', slug: 'transfermovil', icon: 'Smartphone', isActive: b.transferDetails.transfermovil },
      { id: 'enzona', name: 'EnZona', slug: 'enzona', icon: 'Zap', isActive: b.transferDetails.enzona },
      { id: 'qr', name: 'Pago QR', slug: 'qr', icon: 'QrCode', isActive: b.transferDetails.qrPayment },
      { id: 'cash', name: 'Efectivo', slug: 'cash', icon: 'Banknote', isActive: b.transferDetails.cash },
      { id: 'onlineGateway', name: 'Pago online', slug: 'onlineGateway', icon: 'CreditCard', isActive: b.transferDetails.onlineGateway }
    ],
    promotions: b.featured ? [{ type: 'featured', active: true }] : [],
    status: b.status,
    transferActiveNow: b.transferActiveNow,
    transferVerified: b.transferVerified,
    acceptsTransfer: b.acceptsTransfer,
    averageRating: b.rating,
    reviewsCount: b.reviewsCount,
    confirmationsCount: b.confirmationsCount,
    reportsCount: b.reportsCount,
    createdAt: b.lastUpdatedDate,
    updatedAt: b.lastUpdatedDate
  };
}

export async function countBusinesses(): Promise<{ total: number; active: number }> {
  const pool = getPool();

  const fromMemory = (): { total: number; active: number } => {
    const list = memoryEnsure();
    return {
      total: list.length,
      active: list.filter((b) => b.status === 'active').length
    };
  };

  if (!pool || !shouldAttemptDb()) {
    if (canFallbackToMemory()) return fromMemory();
    throw new Error('Database unavailable');
  }
  try {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'active')::int AS active
       FROM businesses`
    );
    markDbAvailable();
    return res.rows[0];
  } catch (err) {
    markDbUnavailable(err);
    if (canFallbackToMemory()) return fromMemory();
    throw new Error('Database unavailable');
  }
}

/* ---------------- MVT vector tiles (Sprint 5, Fase 4) ---------------- */

// Servir el tile Web Mercator z/x/y generado por `get_businesses_mvt`
// (solo negocios active). Devuelve el bytea `mvt` como Buffer; en dev sin BD
// (o con el circuito abierto) devuelve un tile vacío: MapLibre lo dibuja
// como zona sin datos y el fallback in-memory mantiene la app usable.
export async function queryBusinessesMvt(
  z: number,
  x: number,
  y: number
): Promise<Buffer | null> {
  const pool = getPool();
  if (!pool || !shouldAttemptDb()) {
    if (canFallbackToMemory()) return null;
    throw new Error('Database unavailable');
  }
  try {
    const res = await pool.query(
      `SELECT get_businesses_mvt($1::integer, $2::integer, $3::integer) AS mvt`,
      [z, x, y]
    );
    markDbAvailable();
    const mvt = res.rows[0]?.mvt;
    return mvt ? Buffer.from(mvt) : null;
  } catch (err) {
    markDbUnavailable(err);
    if (canFallbackToMemory()) return null;
    throw new Error('Database unavailable');
  }
}
