/**
 * DAO de las estadísticas de visitas.
 *
 * No se guarda nada de quien mira: ni IP, ni identificador, ni user-agent. Solo
 * un contador por negocio y día. Eso acota lo que se puede afirmar —son
 * APERTURAS DE FICHA, no visitantes únicos— y la interfaz usa esas palabras en
 * vez de vender una precisión que estos datos no tienen.
 */

import { crearEjecutor } from './db-runner';

const { run } = crearEjecutor(() => false);

export interface ViewDayRow {
  day: string;
  views: number;
}

/**
 * Suma una apertura. Solo cuenta para negocios publicados: contar los que nadie
 * puede ver todavía infla el número sin significar nada.
 *
 * Devuelve `false` si el negocio no existe o no está activo, para que el
 * endpoint no tenga que consultarlo aparte.
 */
export async function recordBusinessView(businessId: string): Promise<boolean> {
  return run(async (pool) => {
    const res = await pool.query(
      `INSERT INTO business_view_daily (business_id, day, views)
       SELECT b.id, CURRENT_DATE, 1 FROM businesses b
       WHERE b.id = $1 AND b.status = 'active'
       ON CONFLICT (business_id, day)
       DO UPDATE SET views = business_view_daily.views + 1`,
      [businessId]
    );
    return (res.rowCount ?? 0) > 0;
  });
}

/**
 * Serie diaria de los últimos `days` días, con los días sin visitas a cero: una
 * gráfica con huecos miente sobre la forma de la curva.
 */
export async function businessViewStats(
  businessId: string,
  days = 30
): Promise<{ total: number; series: ViewDayRow[] }> {
  const ventana = Math.min(Math.max(Math.trunc(days) || 0, 1), 365);
  return run(async (pool) => {
    const res = await pool.query<{ day: string; views: number }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              COALESCE(v.views, 0)::int AS views
       FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, '1 day') AS d(day)
       LEFT JOIN business_view_daily v
         ON v.business_id = $1 AND v.day = d.day
       ORDER BY d.day`,
      [businessId, ventana]
    );
    const series = res.rows;
    return { total: series.reduce((s, r) => s + r.views, 0), series };
  });
}
