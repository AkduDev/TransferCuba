import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Client } from 'pg';

/**
 * Fixture de cuenta de prueba.
 *
 * El alta se hace contra `POST /api/account/register`, no por SQL: así la
 * prueba ejercita el endpoint real y la cookie de sesión `tc_session` llega al
 * contexto del navegador sin que haya que fabricarla a mano. La promoción de
 * rol y el borrado sí van por SQL, porque no hay endpoint público para ninguna
 * de las dos cosas.
 *
 * NUNCA escribe en la base que use la aplicación por defecto. Exige
 * `E2E_DATABASE_URL`, una base **aparte**; sin ella, las pruebas que pidan
 * cuenta se saltan con un motivo explícito.
 *
 * El proyecto trabaja sobre Neon, así que lo natural es crear una **rama** de
 * la base (`neondb`) desde la consola o `neonctl branches create`, apuntar ahí
 * y borrarla al terminar. Una rama nace con el esquema y los datos ya puestos,
 * que es justo lo que estas pruebas necesitan:
 *
 *   E2E_DATABASE_URL='postgresql://…@ep-…/neondb?sslmode=require' bun run test:e2e
 *
 * `playwright.config.ts` pasa ese valor como `DATABASE_URL` al `next dev` que
 * levanta, así que servidor y fixture hablan con la misma base. Si en su lugar
 * se usa una base vacía, hay que aplicarle antes `db/schema.sql`,
 * `db/migrate_auth.sql` y `db/migrate_delivery.sql`.
 */

/** Marca los datos de prueba para poder reconocer y barrer restos. */
const PREFIJO_TELEFONO = '5550';
const PIN = '24681012';

export type Rol = 'USER' | 'BUSINESS' | 'MESSENGER' | 'ADMIN';

export interface CuentaDePrueba {
  id: string;
  phone: string;
  pin: string;
  name: string;
  rol: Rol;
}

export interface OpcionesDeCuenta {
  /** Rol final. Por encima de USER se aplica por SQL: no hay endpoint. */
  rol?: Rol;
  /** Para MESSENGER, deja además el perfil operativo en ACTIVE. */
  perfilActivo?: boolean;
  /**
   * Días de suscripción que le quedan al mensajero. Negativo o 0 la deja
   * vencida, que es el caso que hay que poder montar para probar la
   * renovación. Por defecto, 30.
   */
  diasDeSuscripcion?: number;
}

export const urlDeLaBaseDePruebas = process.env.E2E_DATABASE_URL ?? '';
export const hayBaseDePruebas = urlDeLaBaseDePruebas.length > 0;

/** Teléfono único de 11 dígitos dentro del rango válido (7–15). */
function telefonoDePrueba(): string {
  const cola = String(Date.now()).slice(-5) + String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return PREFIJO_TELEFONO + cola;
}

async function conectar(): Promise<Client> {
  const client = new Client({ connectionString: urlDeLaBaseDePruebas, connectionTimeoutMillis: 10_000 });
  await client.connect();
  return client;
}

/**
 * Borra la cuenta y lo que cuelga de ella. `delivery_requests.requester_id` es
 * ON DELETE RESTRICT, así que las carreras van primero o el borrado falla; el
 * resto (sessions, messengers_profiles, messengers_payments) cae por cascada.
 */
async function borrarCuenta(id: string): Promise<void> {
  const client = await conectar();
  try {
    await client.query('DELETE FROM delivery_requests WHERE requester_id = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);
  } finally {
    await client.end();
  }
}

async function promover(
  id: string,
  rol: Rol,
  perfilActivo: boolean,
  diasDeSuscripcion: number
): Promise<void> {
  const client = await conectar();
  try {
    await client.query('UPDATE users SET role = $1 WHERE id = $2', [rol, id]);
    if (rol === 'MESSENGER' && perfilActivo) {
      await client.query(
        `INSERT INTO messengers_profiles (user_id, vehicle, service_areas, status, active_since, expires_at)
         VALUES ($1, 'moto', ARRAY['La Habana'], 'ACTIVE', now(), now() + make_interval(days => $2::int))
         ON CONFLICT (user_id) DO UPDATE SET
           status = 'ACTIVE',
           active_since = now(),
           expires_at = now() + make_interval(days => $2::int)`,
        [id, diasDeSuscripcion]
      );
    }
  } finally {
    await client.end();
  }
}

interface FixturesDeCuenta {
  /**
   * Da de alta una cuenta y deja su sesión en el contexto del navegador.
   * Se borra sola al terminar la prueba, pase o falle.
   */
  crearCuenta: (opciones?: OpcionesDeCuenta) => Promise<CuentaDePrueba>;

  /**
   * Como `crearCuenta`, pero con contexto HTTP propio: permite tener varias
   * sesiones vivas a la vez (solicitante y mensajero en la misma prueba), cosa
   * que `page.request` no puede porque comparte cookies con el navegador.
   */
  crearCuentaApi: (
    opciones?: OpcionesDeCuenta
  ) => Promise<{ cuenta: CuentaDePrueba; api: APIRequestContext }>;

  /**
   * Inserta una carrera PENDING por SQL, saltándose OSRM.
   *
   * Crearla por la API exigiría el router público de OSRM, que es una
   * dependencia externa sin SLA: la prueba dejaría de ser hermética y fallaría
   * por causas ajenas al código. Los pasos posteriores (aceptar, recoger,
   * entregar) sí van por la API real, que es lo que se quiere ejercitar.
   */
  crearCarreraPendiente: (requesterId: string) => Promise<{ id: string; code: string }>;
}

export const test = base.extend<FixturesDeCuenta>({
  crearCuentaApi: async ({ playwright, baseURL }, use) => {
    const creadas: string[] = [];
    const contextos: APIRequestContext[] = [];

    const crear = async (opciones: OpcionesDeCuenta = {}) => {
      const { rol = 'USER', perfilActivo = true, diasDeSuscripcion = 30 } = opciones;
      const api = await playwright.request.newContext({ baseURL });
      contextos.push(api);

      const phone = telefonoDePrueba();
      const name = `E2E ${phone.slice(-4)}`;
      const res = await api.post('/api/account/register', { data: { phone, pin: PIN, name, acceptsTerms: true } });
      expect(res.status(), `alta de ${phone}: ${await res.text()}`).toBe(201);

      const cuerpo = (await res.json()) as { user?: { id?: string } };
      const id = cuerpo.user?.id;
      expect(id, 'la respuesta del alta no trae user.id').toBeTruthy();
      creadas.push(id!);

      if (rol !== 'USER') await promover(id!, rol, perfilActivo, diasDeSuscripcion);

      return { cuenta: { id: id!, phone, pin: PIN, name, rol }, api };
    };

    await use(crear);

    for (const api of contextos) await api.dispose();
    for (const id of creadas) {
      await borrarCuenta(id).catch((err) => {
        console.error(`[e2e] no se pudo borrar la cuenta ${id}:`, (err as Error).message);
      });
    }
  },

  crearCarreraPendiente: async ({}, use) => {
    const creadas: string[] = [];

    const crear = async (requesterId: string) => {
      const client = await conectar();
      try {
        // Coordenadas fijas en La Habana y tarifa cerrada: ni OSRM ni pricing.
        const res = await client.query<{ id: string; code: string }>(
          `INSERT INTO delivery_requests (
             code, status, requester_id, package_type,
             pickup_lat, pickup_lng, pickup_address,
             dropoff_lat, dropoff_lng, dropoff_address,
             distance_km, duration_min, base_fare_cup, total_fare_cup
           ) VALUES (
             'TC-' || upper(substr(md5(random()::text), 1, 5)), 'PENDING', $1, 'paquete',
             23.1136, -82.3666, 'Habana Vieja, La Habana',
             23.1385, -82.3842, 'Vedado, La Habana',
             3.2, 12, 200, 300
           ) RETURNING id, code`,
          [requesterId]
        );
        creadas.push(res.rows[0].id);
        return res.rows[0];
      } finally {
        await client.end();
      }
    };

    await use(crear);

    if (creadas.length > 0) {
      const client = await conectar();
      try {
        await client.query('DELETE FROM delivery_requests WHERE id = ANY($1::uuid[])', [creadas]);
      } catch (err) {
        console.error('[e2e] no se pudieron borrar las carreras:', (err as Error).message);
      } finally {
        await client.end();
      }
    }
  },

  crearCuenta: async ({ page }, use) => {
    const creadas: string[] = [];

    const crear = async (opciones: OpcionesDeCuenta = {}): Promise<CuentaDePrueba> => {
      const { rol = 'USER', perfilActivo = true, diasDeSuscripcion = 30 } = opciones;
      const phone = telefonoDePrueba();
      const name = `E2E ${phone.slice(-4)}`;

      // `page.request` comparte almacenamiento con el contexto del navegador:
      // la cookie HttpOnly queda puesta y el siguiente `goto` va autenticado.
      const res = await page.request.post('/api/account/register', {
        data: { phone, pin: PIN, name, acceptsTerms: true }
      });

      if (res.status() === 503) {
        throw new Error(
          'La API respondió 503: PostgreSQL no está disponible para el servidor de pruebas. ' +
            'Revisa E2E_DATABASE_URL y que el endpoint acepte conexiones.'
        );
      }
      expect(res.status(), `alta de ${phone}: ${await res.text()}`).toBe(201);

      const cuerpo = (await res.json()) as { user?: { id?: string } };
      const id = cuerpo.user?.id;
      expect(id, 'la respuesta del alta no trae user.id').toBeTruthy();
      creadas.push(id!);

      if (rol !== 'USER') {
        await promover(id!, rol, perfilActivo, diasDeSuscripcion);
        // El rol vive en la fila, no en la cookie: `useAuth` lo rehidrata con
        // `GET /api/account/me` en la siguiente carga.
        await page.request.get('/api/account/me');
      }

      return { id: id!, phone, pin: PIN, name, rol };
    };

    await use(crear);

    for (const id of creadas) {
      await borrarCuenta(id).catch((err) => {
        console.error(`[e2e] no se pudo borrar la cuenta ${id}:`, (err as Error).message);
      });
    }
  }
});

export { expect, type Page };
