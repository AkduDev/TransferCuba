/**
 * Envoltorios de acceso a Postgres compartidos por los DAO.
 *
 * Implementan el **circuit breaker**: si Postgres es inalcanzable, marcan la
 * base caída 60 s y lanzan `DbUnavailableError` en vez de reintentar en cada
 * petición. Estaban copiados en `db-delivery.ts`, y al añadir `db-ownership.ts`
 * iban por la segunda copia; el cuarto DAO haría la tercera.
 *
 * Lo único que cambia entre módulos es QUÉ cuenta como error de dominio, así
 * que eso se inyecta. La distinción importa: un error de dominio sube tal cual
 * para que el endpoint responda 409, mientras que uno de infraestructura se
 * convierte en `DbUnavailableError` y acaba en 503.
 *
 * `lib/db.ts` mantiene los suyos aparte a propósito: allí una base caída no
 * lanza, sino que devuelve datos en memoria, y forzarlo a este molde cambiaría
 * su comportamiento.
 */

import type { Pool, PoolClient } from 'pg';
import {
  getDbPool,
  shouldAttemptDb,
  markDbUnavailable,
  markDbAvailable,
  DbUnavailableError
} from './db-auth';

export type EsErrorDeDominio = (err: unknown) => boolean;

export interface EjecutorDb {
  /** Consulta suelta, sin transacción. */
  run<T>(fn: (pool: Pool) => Promise<T>): Promise<T>;
  /** Transacción: `BEGIN`/`COMMIT`, y `ROLLBACK` ante cualquier fallo. */
  withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
}

/**
 * Un fallo con `code` viene de Postgres —restricción violada, tipo inválido—,
 * no de que la base esté caída. Se deja pasar sin abrir el breaker: cerrar el
 * circuito por un dato mal formado dejaría la aplicación sin base 60 s por un
 * error del cliente.
 */
function esFalloDeDatos(err: unknown): boolean {
  return typeof (err as { code?: unknown } | null)?.code === 'string';
}

export function crearEjecutor(esErrorDeDominio: EsErrorDeDominio): EjecutorDb {
  async function run<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
    const pool = getDbPool();
    if (!pool || !shouldAttemptDb()) throw new DbUnavailableError();
    try {
      const out = await fn(pool);
      markDbAvailable();
      return out;
    } catch (err) {
      if (esErrorDeDominio(err)) throw err;
      if (esFalloDeDatos(err)) {
        markDbAvailable();
        throw err;
      }
      markDbUnavailable(err);
      throw new DbUnavailableError();
    }
  }

  async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = getDbPool();
    if (!pool || !shouldAttemptDb()) throw new DbUnavailableError();
    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch (err) {
      markDbUnavailable(err);
      throw new DbUnavailableError();
    }
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (esErrorDeDominio(err)) throw err;
      if (esFalloDeDatos(err)) {
        markDbAvailable();
        throw err;
      }
      markDbUnavailable(err);
      throw new DbUnavailableError();
    } finally {
      client.release();
    }
  }

  return { run, withClient };
}
