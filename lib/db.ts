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
import { Business, INITIAL_BUSINESSES, calculateDistanceMeters } from '@/lib/cuba-data';

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
  transfer_details: Business['transferDetails'];
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
    idleTimeoutMillis: 10_000,
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

/* ---------------- conversión fila ⇄ dominio ---------------- */

function rowToBusiness(r: Row): Business {
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
    transferDetails: r.transfer_details,
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
    photos: r.photos ?? [],
    featured: r.featured,
    status: r.status,
    ...(r.distance_meters !== undefined && r.distance_meters !== null
      ? { distanceMeters: Math.round(Number(r.distance_meters)) }
      : {})
  };
}

const businessToInsert = (b: Business) => [
  b.id,
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
  JSON.stringify(b.transferDetails),
  b.acceptsTransfer,
  b.transferActiveNow,
  b.transferVerified,
  b.status,
  b.confirmationsCount,
  b.reportsCount,
  b.rating,
  b.reviewsCount,
  b.featured,
  JSON.stringify(b.photos),
  b.lastStatusUpdate,
  b.lat,
  b.lng
];

const INSERT_SQL = `
  INSERT INTO businesses (
    id, name, category, category_icon, description, province, municipality,
    neighborhood, address, whatsapp, phone, hours, transfer_details,
    accepts_transfer, transfer_active_now, transfer_verified, status,
    confirmations_count, reports_count, rating, reviews_count, featured,
    photos, last_status_update, geom
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
    $21,$22,$23,$24, ST_SetSRID(ST_MakePoint($26, $25), 4326)::geography
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

export async function queryBusinesses(filters: BusinessFilters): Promise<Business[]> {
  const pool = getPool();
  if (!pool) return memoryFilter(filters);

  const where: string[] = filters.includeAll ? [] : [`status = 'active'`];
  const params: unknown[] = [];
  let p = 0;
  const next = (v: unknown) => {
    params.push(v);
    return `$${++p}`;
  };

  if (filters.province && filters.province !== 'all')
    where.push(`province ILIKE ${next(filters.province)}`);
  if (filters.municipality && filters.municipality !== 'all')
    where.push(`municipality ILIKE ${next(filters.municipality)}`);
  if (filters.category && filters.category !== 'all')
    where.push(`category = ${next(filters.category)}`);
  if (filters.onlyTransfer) where.push(`accepts_transfer = TRUE`);
  if (filters.activeNow) where.push(`transfer_active_now = TRUE`);
  if (filters.qr) where.push(`(transfer_details->>'qrPayment')::boolean = TRUE`);
  if (filters.online) where.push(`(transfer_details->>'onlineGateway')::boolean = TRUE`);
  if (!filters.includeAll && filters.verification && filters.verification !== 'all') {
    const v = next(filters.verification);
    where.push(
      `(CASE WHEN reports_count > 0 THEN 'reported'
             WHEN transfer_verified THEN 'verified'
             ELSE 'pending' END) = ${v}`
    );
  }
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    const l = next(like);
    where.push(
      `(name ILIKE ${l} OR description ILIKE ${l} OR address ILIKE ${l}
        OR municipality ILIKE ${l} OR neighborhood ILIKE ${l})`
    );
  }

  // Spatial: viewport bbox (&& envelope) y/u origen+radio (ST_DWithin)
  const hasOrigin = filters.lat !== undefined && filters.lng !== undefined;
  const originParam = hasOrigin ? next(`POINT(${filters.lng} ${filters.lat})`) : null;

  if (filters.bbox) {
    const [w, s, e, n] = filters.bbox;
    where.push(
      `geom && ST_MakeEnvelope(${next(w)}, ${next(s)}, ${next(e)}, ${next(n)}, 4326)`
    );
  }
  if (hasOrigin && filters.radius) {
    where.push(
      `ST_DWithin(geom, ST_GeomFromText(${originParam}, 4326)::geography, ${next(filters.radius)})`
    );
  }

  const emptyWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const select = `SELECT *, ${
    hasOrigin
      ? `ST_Distance(geom, ST_GeomFromText(${originParam}, 4326)::geography) AS distance_meters`
      : 'NULL::double precision AS distance_meters'
  } FROM businesses`;

  const orderBy = hasOrigin
    ? `ORDER BY distance_meters ASC NULLS LAST`
    : `ORDER BY featured DESC, rating DESC`;
  const limit = next(filters.limit ?? 500);

  const sql = `${select} ${emptyWhere} ${orderBy} LIMIT ${limit}`;

  try {
    const res = await pool.query(sql, params);
    const businesses = res.rows.map(rowToBusiness);
    // lat/lng no vengan en row: los rehidratamos del geometry para el cliente
    if (res.rows.length) {
      const coords = await pool.query(
        `SELECT id, ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat FROM businesses WHERE id = ANY($1::text[])`,
        [businesses.map((b) => b.id)]
      );
      const coordsMap = new Map(
        coords.rows.map((r: { id: string; lng: number; lat: number }) => [r.id, r])
      );
      return businesses.map((b) => {
        const c = coordsMap.get(b.id);
        return c ? { ...b, lat: c.lat, lng: c.lng } : b;
      });
    }
    return businesses;
  } catch (err) {
    console.error('[db] queryBusinesses failed, falling back to memory:', err);
    return memoryFilter(filters);
  }
}

export async function insertBusiness(b: Business): Promise<void> {
  const pool = getPool();
  if (!pool) {
    memoryEnsure().unshift({ ...b });
    return;
  }
  try {
    await pool.query(INSERT_SQL, businessToInsert(b));
  } catch (err) {
    console.error('[db] insertBusiness failed:', err);
    memoryEnsure().unshift({ ...b });
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

  if (!pool) {
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
    const res = await pool.query(updates[action], params);
    if (!res.rows.length) return null;
    if (action === 'delete') return null;
    const fetched = await queryBusinessesByIds([id]);
    return fetched.get(id) ?? null;
  } catch (err) {
    console.error('[db] patchBusiness failed:', err);
    return null;
  }
}

export async function queryBusinessesByIds(ids: string[]): Promise<Map<string, Business>> {
  const pool = getPool();
  if (!pool) {
    const map = new Map<string, Business>();
    memoryEnsure().forEach((b) => {
      if (ids.includes(b.id)) map.set(b.id, b);
    });
    return map;
  }
  try {
    const res = await pool.query(
      `SELECT *, NULL::double precision AS distance_meters,
              ST_X(geom::geometry) AS lng_raw, ST_Y(geom::geometry) AS lat_raw
       FROM businesses WHERE id = ANY($1::text[])`,
      [ids]
    );
    const map = new Map<string, Business>();
    res.rows.forEach((r: Row & { lng_raw: number; lat_raw: number }) => {
      map.set(r.id, { ...rowToBusiness(r), lat: r.lat_raw, lng: r.lng_raw });
    });
    return map;
  } catch (err) {
    console.error('[db] queryBusinessesByIds failed:', err);
    return new Map();
  }
}

export async function countBusinesses(): Promise<{ total: number; active: number }> {
  const pool = getPool();
  if (!pool) {
    const list = memoryEnsure();
    return {
      total: list.length,
      active: list.filter((b) => b.status === 'active').length
    };
  }
  try {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'active')::int AS active
       FROM businesses`
    );
    return res.rows[0];
  } catch {
    const list = memoryEnsure();
    return { total: list.length, active: list.filter((b) => b.status === 'active').length };
  }
}
