# Operaciones — despliegue, base de datos y entornos

Runbook de lo que hay montado en producción y de cómo tocarlo. Recoge cosas que
solo se aprenden tropezando; si algo aquí contradice a la realidad, gana la
realidad — verifícalo antes de fiarte.

## Qué hay

| Pieza | Valor |
|---|---|
| Proyecto Vercel | `transfercuba` (`prj_53KQ2H6tsrt3UIEiI2QGzWRct5UB`) |
| Producción | `https://transfercuba.vercel.app` |
| Despliegue | Integración con GitHub sobre `main`: **un push a `main` despliega** |
| Proyecto Neon | `soft-shape-61529281` — región `aws-us-east-2` |
| Organización Neon | `org-young-silence-15524269` |
| Ramas Neon | `production` (por defecto) y `preview` |

`neonctl` pide la organización de forma interactiva: pasa
`--org-id org-young-silence-15524269` en cada comando para que no se cuelgue.

## Variables de entorno

Cuatro variables, las tres superficies cubiertas:

| Variable | Production | Preview | Development |
|---|:--:|:--:|:--:|
| `DATABASE_URL` | ✓ | ✓ | ✓ |
| `ADMIN_USERNAME` | ✓ | ✓ | ✓ |
| `ADMIN_PASSWORD` | ✓ | ✓ | ✓ |
| `ADMIN_TOKEN_SECRET` | ✓ | ✓ | ✓ |

Dos decisiones deliberadas:

- **Preview y Development apuntan a la rama `preview` de Neon, no a producción.**
  Copiar el `DATABASE_URL` de producción habría hecho que cualquier despliegue
  de vista previa escribiera en la base real. Una rama de Neon es copia sobre
  escritura: nace con el esquema y los datos, y lo que se escriba ahí no toca
  producción.
- **Las credenciales de administración son distintas en cada entorno.** Un
  despliegue de vista previa tiene menos protección que producción; compartir la
  contraseña sería degradar la de producción al nivel de la más débil.

### Cloudinary

Las fotos de negocios se suben **directamente desde el navegador** a Cloudinary
con un preset *unsigned*; el servidor solo guarda la URL resultante.

| Variable | Valor | Estado |
|---|---|---|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `ds7tspnjm` | configurada en los 3 entornos |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `transfercuba_businesses` | configurada en los 3 entornos |
| `CLOUDINARY_API_KEY` | — | **sin configurar** |
| `CLOUDINARY_API_SECRET` | — | **sin configurar** |

Las dos primeras no son secretas: viajan al navegador por definición (es lo que
exige una subida unsigned) y se **incrustan en build**, así que al cambiarlas
hay que redesplegar para que surtan efecto.

El preset `transfercuba_businesses` es `unsigned` y publica en la carpeta
`businesses`, que es la misma que manda el cliente. La protección contra abuso
no es código: son las restricciones del preset en el panel de Cloudinary
(formatos, tamaño máximo, carpeta), porque cualquiera puede leer el nombre del
preset en el bundle.

**Qué falta sin las claves de API.** Solo las usa `deleteAsset`
(`lib/cloudinary.ts`), desde `DELETE /api/businesses/[id]/images/[imageId]`.
Ese endpoint degrada con gracia: si el borrado en Cloudinary falla, igualmente
quita la imagen del negocio. O sea que **no rompe nada visible**, pero el
fichero se queda huérfano en Cloudinary consumiendo cuota. Para cerrarlo:

```bash
vercel env add CLOUDINARY_API_KEY production
vercel env add CLOUDINARY_API_SECRET production
```

(Y lo mismo para `preview` y `development`, recordando el positional de rama
vacío que se describe más abajo.)

El CLI `cld` de la máquina de desarrollo está autenticado por OAuth contra este
mismo cloud, así que `cld admin upload_presets` lista los presets sin necesidad
de claves.

## Migraciones

El orden **no es alfabético** y aplicarlas con un glob falla
(`migrate_delivery` depende de `migrate_auth`):

```
db/schema.sql
db/migrate_auth.sql
db/migrate_delivery.sql
db/migrate_promotions_index.sql
db/migrate_delivery_phase6.sql
db/migrate_has_delivery.sql
db/migrate_business_last_updated_default.sql
db/migrate_mvt_enhance.sql
db/migrate_mvt_perf.sql
db/migrate_terms_accepted.sql
db/migrate_business_ownership.sql
db/migrate_plans.sql
db/migrate_featured_from_plans.sql
db/migrate_business_stats.sql
```

`migrate_v2.sql` y `migrate_1_9_drop_legacy.sql` son históricos: solo para bases
anteriores a 1.9. Todas son idempotentes. Un cambio de esquema añade migración
**y** actualiza `schema.sql`.

### Qué añadió el módulo de dueños

Tres migraciones seguidas (`business_ownership`, `plans`, `featured_from_plans`,
`business_stats`) montaron esto, y todo está aplicado en `production` y en
`preview`:

| Tabla / vista | Para qué |
|---|---|
| `businesses.owner_user_id` | Dueño confirmado. NULL mientras nadie lo reclame |
| `business_ownership_claims` | Solicitudes de propiedad, que confirma un administrador |
| `plans` | Catálogo y **precios**. Un plan nuevo es una FILA, no una migración |
| `plan_subscriptions` | Qué tiene contratado cada quien, con su vencimiento |
| `plan_payments` | Pagos, con el importe y el periodo **congelados** al pedirlos |
| `business_view_daily` | Contador de aperturas por negocio y día |
| `business_featured` (vista) | La ÚNICA definición de "está destacado" |

Dos cosas que no son obvias:

- **Los precios se cambian desde el panel** (pestaña «Planes»), no tocando SQL.
  Cambiarlos no reescribe lo ya pedido, porque cada pago guardó su propio
  importe.
- **`business_featured` la consultan el DAO y la función MVT.** Si añades otro
  sitio que necesite saber si un negocio está destacado, úsala; no repitas la
  regla, que es justo lo que se vino a arreglar.

### Deriva entre `schema.sql` y producción

`schema.sql` y la base real **no coinciden del todo**: producción ha ido
evolucionando a mano. Ya han aparecido dos casos, y conviene asumir que habrá
más:

- `businesses.last_updated_date` tenía `DEFAULT now()` en producción pero no en
  `schema.sql`. Eso enmascaraba un fallo real del código —el `INSERT` no
  aportaba la columna— que reventaba en cualquier base creada desde el fichero.
- El índice de `business_promotions` usaba `NOW()` en su predicado, lo que hacía
  que `schema.sql` **abortara a mitad** y todo lo posterior (incluida
  `get_businesses_mvt`) no se creara nunca.

Antes de dar por buena una suposición sobre el esquema, consúltalo.

### Aplicar SQL a Neon

**El puerto 5432 puede estar bloqueado** según desde dónde trabajes: aquí la
salida IPv6 no funciona y por IPv4 el TLS se corta, así que `psql` no conecta ni
forzando la IP. La vía que sí funciona es el endpoint SQL sobre HTTPS:

```bash
CS=$(neonctl connection-string production \
      --project-id soft-shape-61529281 \
      --org-id org-young-silence-15524269 | tail -1)
HOST=$(echo "$CS" | sed -E 's|.*@([^/?]+).*|\1|')

curl -s -X POST "https://$HOST/sql" \
  -H "Neon-Connection-String: $CS" \
  -H "Content-Type: application/json" \
  -d '{"query":"select 1","params":[]}'
```

Comprueba siempre el estado **antes** de escribir: varias de estas migraciones
ya estaban aplicadas y el `ALTER` resultó un no-op.

## Caché

Lo que se cachea, dónde y por qué. Vercel **recorta `s-maxage` y
`stale-while-revalidate`** de la cabecera que llega al navegador —son
directivas de CDN— así que al comprobar con `curl` solo verás el `max-age`.

| Recurso | Navegador | CDN | Motivo |
|---|---|---|---|
| `/map/cuba.pmtiles` (85 MB) | 1 año, `immutable` | 1 año | Lleva la huella del contenido en la URL |
| `/api/tiles/{z}/{x}/{y}` | 120 s | 300 s + SWR 1 día | Cambia al aprobar un negocio **y al confirmar un pago** |
| `/api/businesses` público | 60 s | 300 s + SWR 1 h | El catálogo cambia poco |
| `/api/businesses?includeAll=true` | — | **`private, no-store`** | Lleva negocios pendientes tras comprobar sesión |
| `/api/plans` | 30 s | 60 s | El precio lo cambia el administrador; TTL corto a propósito |
| Todo lo de `/api/admin/*` y `/api/account/*` | — | **`private, no-store`** | Depende de la sesión o lleva teléfonos |

Tres reglas que conviene no romper:

- **Una respuesta que dependa de la sesión jamás lleva `public`.** La CDN cachea
  por URL y las cookies no entran en la clave: una respuesta guardada por un
  administrador se serviría a cualquiera, sin que el control de sesión llegue a
  ejecutarse. Ya pasó con `includeAll=true`.
- **El `max-age` del navegador va corto**, porque una vez servido no hay forma de
  purgarlo. El `s-maxage` sí puede ser largo: la CDN se purga sola al desplegar.
- **El mapa base es `immutable` SOLO porque la URL lleva su huella**
  (`?v=<sha256[0:12]>`, calculada en `next.config.ts` al construir). Si alguna vez
  se quita el versionado, hay que quitar el `immutable` a la vez: si no, quien lo
  tenga cacheado se queda con el mapa viejo un año y no hay manera de avisarle.
  Lo vigila `e2e/mapa-base.spec.ts`.

### El TTL de las teselas y los pagos

`s-maxage` de las teselas bajó de 1 h a 5 min al entrar los planes: una tesela ya
no cambia solo cuando un administrador aprueba un negocio, también cuando
confirma un pago — y hacer esperar una hora a quien acaba de pagar por destacarse
no se sostiene. El coste es asumible porque `get_businesses_mvt` tarda ~5 ms.

Si algún día el catálogo crece y ese TTL pesa, la salida NO es volver a subirlo:
es versionar la URL de las teselas como se hizo con el mapa base.

## Rarezas del CLI de Vercel

Añadir una variable a **todas** las ramas de Preview falla con
`action_required / git_branch_required`, incluso con `--yes` y aunque el propio
CLI sugiera exactamente ese comando. La forma que funciona es pasar el
positional de rama **vacío**:

```bash
vercel env add NOMBRE preview "" --value "$VALOR" --yes
```

Sin esas comillas vacías el comando falla **en silencio** si suprimes su salida:
conviene comprobar con `vercel env ls` después de cada alta, no fiarse del
código de salida.

## Pruebas contra un despliegue real (Preview)

`e2e-preview/` corre contra un despliegue de Vercel de verdad, no contra el dev
server. Es lo único que demuestra lo que solo existe tras un build: que las
`NEXT_PUBLIC_CLOUDINARY_*` se incrustaron en el bundle y que la subida al
navegador cruza hasta Cloudinary.

```bash
P=$(vercel ls transfercuba --json | …)   # o la URL del despliegue a mano
vercel env run -- sh -c "PREVIEW_URL='$P' bunx playwright test \
  --config playwright.preview.config.ts"
```

Apunta a la rama `preview` de Neon, así que puede escribir. **Lo que cree hay
que borrarlo**: la fila en `businesses` (y su `business_images`) y el asset en
Cloudinary (`cld uploader destroy businesses/<public_id>`).

### El token de SSO no puede ir en `extraHTTPHeaders`

Los despliegues de Preview están tras la protección de Vercel: sin
`x-vercel-trusted-oidc-idp-token` cada navegación acaba en un 302 a
`vercel.com/sso-api`. Pero `extraHTTPHeaders` de Playwright se aplica a **todas**
las peticiones del contexto, terceros incluidos, y eso rompe la subida de fotos:

- una cabecera no estándar convierte la POST a `api.cloudinary.com` en una
  petición con preflight;
- Cloudinary no declara esa cabecera en `Access-Control-Allow-Headers`;
- el preflight falla y la subida muere con `net::ERR_FAILED`, **sin respuesta
  HTTP que mirar** — parece un fallo de la aplicación y no lo es.

Y, aparte de la prueba, mandar un token de acceso a un tercero es filtrarlo.

El token se inyecta por `page.route` solo al origen de Vercel
(`e2e-preview/fixtures/preview.ts`). Si alguna vez se ve `ERR_FAILED` contra un
dominio externo, mírese esto antes que el código de la aplicación.

## Pruebas contra base de datos

Las pruebas que necesitan sesión se **saltan solas** sin `E2E_DATABASE_URL`, y
nunca escriben en la base de la aplicación:

```bash
E2E_DATABASE_URL='postgresql://…' bun run test:e2e
```

Lo natural es una rama de Neon (`neonctl branches create`), que nace con el
esquema puesto. La moderación de valoraciones pide además `E2E_ADMIN_PASSWORD`.

Alternativa sin tocar Neon: un contenedor desechable. **Ahora mismo no hay
ninguno levantado**, así que 73 pruebas se saltan solas y quedan 21 efectivas,
frente a las 94 que corren con base. Para recrearlo:

```bash
docker run -d --name tc-e2e-pg \
  -e POSTGRES_PASSWORD=e2e -e POSTGRES_USER=e2e -e POSTGRES_DB=transfercuba_e2e \
  -p 5433:5432 postgis/postgis:16-3.4-alpine

# Esperar a que TERMINE de inicializarse (ver aviso más abajo)
until docker logs tc-e2e-pg 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 2; done
sleep 3

# Las 13 migraciones, en orden. `ON_ERROR_STOP=1` para que no siga a ciegas.
for f in schema migrate_auth migrate_delivery migrate_promotions_index \
         migrate_delivery_phase6 migrate_has_delivery \
         migrate_business_last_updated_default migrate_mvt_enhance \
         migrate_mvt_perf migrate_terms_accepted migrate_business_ownership \
         migrate_plans migrate_featured_from_plans migrate_business_stats; do
  docker exec -i tc-e2e-pg psql -U e2e -d transfercuba_e2e -v ON_ERROR_STOP=1 -q \
    < "db/$f.sql" && echo "✔ $f" || echo "✘ $f"
done

# El panel de mensajería deja el botón de renovar sin tarjeta a la que pagar
# si esto está vacío, y tres pruebas fallan sin decir por qué.
docker exec tc-e2e-pg psql -U e2e -d transfercuba_e2e -qc \
  "update platform_config set messenger_pay_card='9227000000000000',
                              messenger_whatsapp='55500000' where id=1"
```

Y para correrla:

```bash
E2E_DATABASE_URL='postgresql://e2e:e2e@127.0.0.1:5433/transfercuba_e2e' \
E2E_ADMIN_USER=<el de .env.local> E2E_ADMIN_PASSWORD=<el de .env.local> \
  bun run test:e2e
```

Al terminar, `docker rm -f -v tc-e2e-pg`. El `-v` importa: sin él queda un
volumen anónimo ocupando disco que nadie reclama.

**La suite ensucia esa base a propósito y no la limpia**: cada pasada deja
negocios creados y aprobados. Es desechable, pero conviene recrearla de vez en
cuando — con cientos de negocios acumulados algunas pruebas de interfaz empiezan
a comportarse distinto.

Espera a la línea `PostgreSQL init process complete` del log **antes** de
conectar: el contenedor arranca un servidor temporal para sus scripts de inicio
y lo reinicia después, así que `pg_isready` da verde demasiado pronto.

## Verificación antes de desplegar

`architecture.md` documenta que `bun run build` tarda ~8 min en el disco NTFS de
desarrollo y delega la build integral a CI. Para el día a día:

```bash
bunx tsc --noEmit
bunx eslint .
bun run test:e2e
```

El repo arrastra 3 errores de lint previos (`react-hooks/set-state-in-effect`) y
1 aviso. Compara contra esa línea base antes de dar uno por tuyo:

```bash
git show HEAD:<fichero> | bunx eslint --stdin --stdin-filename <fichero>
```

### Presupuestos de tiempo de las pruebas

`playwright.config.ts` usa **20 s por aserción y 120 s por prueba**, no los
valores por defecto. Está medido, no elegido a ojo: una prueba de interfaz de
este proyecto tarda entre 10 y 25 s contra el dev server (la portada sola son
~6 s con el mapa, y cada ruta se compila al primer golpe).

Con los 10 s que traía, las mismas pruebas **pasaban aisladas y fallaban en
tanda**, y eso costó varias sesiones de diagnósticos falsos: parecían
regresiones y eran presupuesto. Una suite que miente bajo carga es peor que una
lenta.

`workers: 1` también es deliberado: en el disco NTFS de desarrollo varios
workers contra un único `next dev` compiten por I/O y producen timeouts, no
paralelismo.

La mejora de fondo sería correr la suite contra `next build` en vez del dev
server; entonces estos presupuestos se pueden volver a bajar.
