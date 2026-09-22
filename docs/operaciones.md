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

### Lo que FALTA: Cloudinary

La subida de fotos del registro de negocios **no funciona en ningún entorno**,
porque no hay ninguna variable de Cloudinary configurada (ni integración
instalada). El formulario muestra "Fotos no configuradas. Contacta al
administrador." y no sube nada.

```bash
vercel env add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME production
vercel env add NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET production
vercel env add CLOUDINARY_API_KEY production
vercel env add CLOUDINARY_API_SECRET production
vercel --prod   # las NEXT_PUBLIC_* se incrustan en build: hay que redesplegar
```

Las dos primeras habilitan la subida; las dos últimas solo hacen falta para el
borrado firmado de assets. El `upload_preset` debe existir en el panel de
Cloudinary como **unsigned**.

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
```

`migrate_v2.sql` y `migrate_1_9_drop_legacy.sql` son históricos: solo para bases
anteriores a 1.9. Todas son idempotentes. Un cambio de esquema añade migración
**y** actualiza `schema.sql`.

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

## Pruebas contra base de datos

Las pruebas que necesitan sesión se **saltan solas** sin `E2E_DATABASE_URL`, y
nunca escriben en la base de la aplicación:

```bash
E2E_DATABASE_URL='postgresql://…' bun run test:e2e
```

Lo natural es una rama de Neon (`neonctl branches create`), que nace con el
esquema puesto. La moderación de valoraciones pide además `E2E_ADMIN_PASSWORD`.

Alternativa sin tocar Neon: un contenedor desechable con las migraciones
aplicadas en el orden de arriba.

```bash
docker run -d --name tc-e2e-pg \
  -e POSTGRES_PASSWORD=e2e -e POSTGRES_USER=e2e -e POSTGRES_DB=transfercuba_e2e \
  -p 5433:5432 postgis/postgis:16-3.4-alpine
```

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
