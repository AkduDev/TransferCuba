# Fase 6 — Historial, valoraciones y eventos en vivo

## Estado

**Próxima tarea.** La Fase 5 de alta pagada de mensajeros ya está implementada en el commit `f73567d`. Esta fase no está implementada todavía; este documento define el alcance, el contrato técnico y los criterios de aceptación para la siguiente entrega.

## Objetivo

Completar el ciclo operativo del módulo de mensajería:

1. Ofrecer un historial útil y paginado para solicitantes y mensajeros.
2. Permitir valorar al mensajero después de una entrega completada.
3. Reemplazar el polling periódico por eventos en vivo mediante SSE, manteniendo polling como fallback.
4. Mantener la privacidad por rol y la compatibilidad con el mapa, los modales y los hooks actuales.

## Estado de entrada

La Fase 5 dejó implementado:

- `GET /api/messenger/apply`: carga configuración, perfil y pagos del solicitante.
- `POST /api/messenger/apply`: crea el perfil `PENDING` y el pago de alta.
- `GET/PATCH /api/admin/platform`: configuración de tarifa, cuenta destino y WhatsApp.
- `GET /api/admin/messengers` y `PATCH /api/admin/messengers/[userId]`: revisión administrativa.
- `lib/hooks/useMessengerApplication.ts`: estado del formulario de alta.
- `components/MessengerAdminPanel.tsx`: panel de revisión de pagos.
- `components/GoogleMapsMessengerModal.tsx`: flujo de solicitud para usuarios que aún no son mensajeros y tablón para mensajeros activos.
- `messengers_profiles`, `messengers_payments` y `platform_config` en PostgreSQL.

Quedan como brecha de la Fase 6:

- El historial existe parcialmente mediante `GET /api/deliveries`, pero la UI del mensajero no tiene una pestaña de historial y no hay paginación explícita.
- No existe una valoración de entrega ni una agregación visible del rendimiento del mensajero.
- `useDeliveries` consulta cada 12 s (solicitante) y 15 s (mensajero); el mapa y los modales no reciben eventos en vivo.

## Alcance funcional

### 1. Historial de carreras

- Solicitante: ve sus carreras solicitadas, ordenadas de la más reciente a la más antigua.
- Mensajero: ve las carreras asignadas, incluyendo completadas, canceladas y expiradas.
- Administrador: puede consultar el historial completo con filtros y sin exponer datos fuera de su rol.
- Respuesta paginada con `limit` y `cursor`; el valor inicial será compatible con las 30 carreras actuales.
- Cada fila muestra código, estado, fechas, origen/destino según el rol, tarifa, contraparte autorizada y valoración asociada.
- El historial debe poder recargarse manualmente y actualizarse al recibir un evento SSE.

### 2. Valoraciones de entregas

MVP de esta fase:

- El solicitante puede valorar al mensajero asignado cuando la carrera está en `DELIVERED`.
- La valoración es única por `(delivery_id, requester_id)`.
- Puntuación obligatoria de 1 a 5; comentario opcional de máximo 500 caracteres.
- La valoración puede estar `active`, `hidden` o `removed`; solo administración puede cambiar ese estado.
- El perfil del mensajero muestra rating promedio, cantidad de valoraciones y carreras completadas.
- Las columnas `rating` y `completed_orders` de `messengers_profiles` se tratan como caché derivada; la fuente de verdad de la valoración es `delivery_reviews`.

No forma parte del MVP:

- Valoración bidireccional del solicitante por parte del mensajero.
- Reclamaciones, disputas o reembolsos.
- Notificaciones push o por correo.
- Moderación pública de comentarios fuera del panel administrativo.

### 3. Eventos en vivo

- Endpoint SSE autenticado y filtrado por rol.
- Eventos para cambios de estado, nuevas carreras disponibles, valoraciones y latidos.
- El cliente reconecta con `Last-Event-ID`, usa backoff y limpia la conexión al desmontarse.
- Si SSE no está disponible o falla, se mantiene el polling actual como fallback.
- Los eventos respetan el mismo contrato de privacidad que las respuestas JSON: una carrera disponible nunca incluye la dirección de entrega ni la identidad del solicitante.

## Modelo de datos propuesto

### Tabla `delivery_reviews`

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

CREATE INDEX IF NOT EXISTS idx_delivery_reviews_delivery
  ON delivery_reviews (delivery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_reviews_messenger
  ON delivery_reviews (messenger_id, status, created_at DESC);
```

Reglas de integridad que debe validar el backend:

- `delivery_id` existe y está en `DELIVERED`.
- `requester_id` coincide con `delivery_requests.requester_id`.
- `messenger_id` coincide con `delivery_requests.messenger_id`.
- El solicitante no puede valorar dos veces la misma carrera.
- Un comentario vacío se guarda como `NULL`.
- Solo administración puede ocultar o eliminar una valoración.

### Agregados del mensajero

- `completed_orders` se incrementa una sola vez cuando una carrera pasa a `DELIVERED`; la transición actual ya es idempotente por estado.
- `rating` se recalcula desde las valoraciones `active` del mensajero.
- El conteo de valoraciones se calcula con `COUNT(*)`; no es necesario añadir otra columna.
- Si se prefiere caché adicional, puede añadirse `reviews_count`, pero debe actualizarse en la misma transacción que la valoración.

### Eventos y cursores

`delivery_status_events` ya registra las transiciones. Para SSE se puede usar:

- `delivery_status_events.created_at` e `id` como cursor para cambios de estado.
- `delivery_reviews.created_at` e `id` como cursor para valoraciones.
- `delivery_requests.requested_at` e `id` para altas de carreras disponibles.

No se requiere una tabla nueva de eventos para el MVP. El endpoint SSE puede consultar los cambios posteriores al cursor y enviar latidos mientras no haya novedades.

## Contrato API propuesto

### `GET /api/deliveries/history`

Autenticación obligatoria.

Query params:

- `limit`: 1–50, defecto 30.
- `cursor`: fecha/identificador opaco devuelto por la respuesta anterior.
- `status`: filtro opcional (`PENDING`, `ACCEPTED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`, `EXPIRED`).

Respuesta:

```json
{
  "success": true,
  "deliveries": [{}],
  "nextCursor": "..."
}
```

Reglas de acceso:

- `USER`/`BUSINESS`: solo carreras donde `requester_id` es el usuario.
- `MESSENGER`: solo carreras donde `messenger_id` es el usuario.
- `ADMIN`: todas, con los mismos DTO privados por rol.

`GET /api/deliveries` puede mantenerse como alias compatible con `limit=30` durante la migración.

### `GET /api/deliveries/[id]/reviews`

Devuelve las valoraciones visibles de una carrera. Requiere autenticación y acceso a la carrera según las reglas de `GET /api/deliveries/[id]`.

### `POST /api/deliveries/[id]/reviews`

Solo el solicitante de una carrera `DELIVERED`.

Body:

```json
{ "rating": 5, "comment": "Muy buen trato y entrega rápida" }
```

Respuestas:

- `201`: valoración creada.
- `400`: puntuación o comentario inválido.
- `403`: no es el solicitante, no es mensajero asignado o la carrera no está entregada.
- `404`: carrera no encontrada.
- `409`: ya existe una valoración para esa carrera.
- `503`: PostgreSQL no disponible.

### `PATCH /api/admin/deliveries/reviews/[reviewId]`

Solo administración.

Body:

```json
{ "action": "hide" }
```

Acciones: `hide`, `restore`, `remove`. `remove` cambia el estado lógico; no se elimina físicamente el registro para conservar auditoría.

### `GET /api/messengers/[userId]/stats`

Opcional para la UI de historial/perfil. Devuelve:

```json
{
  "success": true,
  "stats": {
    "rating": 4.8,
    "reviewCount": 12,
    "completedOrders": 18
  }
}
```

El endpoint debe restringir el acceso al propio mensajero o a administración. También puede integrarse en `GET /api/deliveries/history` para evitar una petición adicional.

### `GET /api/deliveries/stream`

SSE autenticado. Headers esperados:

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Eventos:

```text
event: delivery.updated
id: delivery-status-event-id
data: {"type":"delivery.updated","delivery":{...}}

event: delivery.available
id: delivery-id
data: {"type":"delivery.available","delivery":{...}}

event: delivery.reviewed
id: review-id
data: {"type":"delivery.reviewed","review":{...}}

event: heartbeat
id: timestamp
data: {"type":"heartbeat"}
```

El cliente debe ignorar eventos fuera de su ámbito y conservar el último `id` recibido.

## DTOs cliente/servidor

Ampliar `lib/delivery-client.ts` y `lib/delivery-dto.ts` con:

```ts
export interface DeliveryReviewDTO {
  id: string;
  deliveryId: string;
  deliveryCode: string;
  requester: { id: string; name: string };
  messenger: { id: string; name: string };
  rating: number;
  comment: string | null;
  status: 'active' | 'hidden' | 'removed';
  createdAt: string;
}

export interface MessengerStatsDTO {
  rating: number | null;
  reviewCount: number;
  completedOrders: number;
}
```

`DeliveryDTO` debe poder incluir `review?: DeliveryReviewDTO | null` y `messengerStats?: MessengerStatsDTO` cuando la consulta lo solicite. Los campos de ubicación e identidad siguen condicionales según el rol; no se debe ampliar la respuesta disponible para mensajería con datos privados.

## DAO y backend

Archivos y responsabilidades:

- `db/migrate_delivery_phase6.sql`: migración idempotente de `delivery_reviews` e índices.
- `db/schema.sql`: definición de referencia del esquema completo.
- `lib/db-delivery.ts`:
  - `listDeliveryHistory(userId, role, options)`;
  - `createDeliveryReview(input)`;
  - `listDeliveryReviews(deliveryId)`;
  - `updateDeliveryReviewStatus(reviewId, status, adminId)`;
  - `getMessengerStats(messengerId)`;
  - `listDeliveryEventsAfter(cursor, scope)` para el stream.
- `app/api/deliveries/history/route.ts`: historial paginado.
- `app/api/deliveries/[id]/reviews/route.ts`: lectura y creación de valoraciones.
- `app/api/admin/deliveries/reviews/[reviewId]/route.ts`: moderación.
- `app/api/deliveries/stream/route.ts`: SSE.
- `lib/delivery-dto.ts`: mapeo y privacidad.
- `lib/auth.ts`: validación de rol y ownership; no confiar en IDs enviados por el cliente.

La creación de una valoración debe ejecutarse en transacción y usar la restricción única para evitar duplicados bajo concurrencia. El cálculo del rating debe usar una consulta agregada o una transacción con bloqueo de fila del perfil.

## Cliente y UI

### Hook `lib/hooks/useDeliveries.ts`

Ampliar el estado con:

- `history`, `messengerHistory` y paginación;
- `openHistory` y recarga manual;
- `submitReview(deliveryId, rating, comment)`;
- `streamState: 'disconnected' | 'connecting' | 'connected' | 'fallback'`;
- `refreshHistory` y actualización de carreras activas desde eventos.

Implementar un gestor SSE reutilizable:

1. Crear `EventSource('/api/deliveries/stream')` solo con sesión activa.
2. Guardar el último `event.lastEventId`.
3. Reconectar con backoff progresivo y límite máximo.
4. Escuchar `delivery.updated`, `delivery.available`, `delivery.reviewed` y `heartbeat`.
5. Actualizar historial, carrera activa, tablón y mapa sin recargar la página.
6. Pasar a polling si SSE falla o el endpoint responde con un estado no compatible.
7. Cerrar la conexión al cambiar de rol, cerrar sesión o desmontar el hook.

### Solicitante

En `components/GoogleMapsDeliveryModal.tsx`:

- Historial con filtros por estado y paginación.
- Al recibir `DELIVERED`, mostrar una tarjeta “Valorar mensajero”.
- Selector de 1–5 estrellas, comentario opcional y botón de envío.
- Mostrar la valoración enviada y permitir editarla solo si la API lo permite; el MVP puede hacerla definitiva.
- Mantener el botón “Ver mis envíos” y el enlace desde la pantalla de éxito.

### Mensajero

En `components/GoogleMapsMessengerModal.tsx`:

- Nueva pestaña “Historial” junto a “Carreras” y “Mi carrera”.
- Resumen de rating, valoraciones y entregas completadas.
- Lista paginada de carreras asignadas con estado y valoración recibida.
- El tablón y la carrera activa se actualizan por SSE; el polling queda como fallback.

### Mapa

`components/MapLibreMap.tsx` y `app/page.tsx` deben seguir recibiendo `activeDeliveryTrip` y `deliveryRequests` desde `useDeliveries`. Los eventos SSE deben actualizar esas props sin recrear fuentes o capas innecesariamente; usar `setData()` y actualizaciones de feature properties.

## Seguridad y privacidad

- Toda lectura y escritura requiere sesión `tc_session` válida.
- El servidor determina el rol desde la sesión; nunca desde el body o la URL.
- Solicitante y mensajero solo acceden a carreras propias/asignadas.
- `GET /api/deliveries/available` y `delivery.available` nunca incluyen `dropoff`, solicitante ni contacto.
- La valoración solo la crea el solicitante de una carrera entregada.
- Los comentarios se almacenan como texto, se renderizan sin HTML y se limitan a 500 caracteres.
- Administración puede moderar, pero la eliminación física no es necesaria.
- SSE debe validar la sesión antes de abrir el stream y cerrar la conexión si la sesión caduca.
- No registrar direcciones, teléfonos ni comentarios en logs.

## Criterios de aceptación

- [ ] El solicitante ve un historial paginado con sus carreras y estados correctos.
- [ ] El mensajero ve un historial paginado solo con sus carreras asignadas.
- [ ] Una carrera `DELIVERED` permite una única valoración de 1 a 5.
- [ ] La valoración actualiza el rating y el conteo visible del mensajero.
- [ ] Un segundo intento de valoración devuelve `409` y no duplica datos.
- [ ] Un usuario no puede valorar una carrera que no solicitó.
- [ ] Administración puede ocultar, restaurar o eliminar lógicamente una valoración.
- [ ] Los cambios de estado llegan por SSE en menos de 3 s en desarrollo.
- [ ] El cliente reconecta tras una desconexión y conserva el cursor.
- [ ] Si SSE falla, el polling de 12/15 s sigue funcionando.
- [ ] El mapa actualiza la carrera activa y el tablón sin recargar la página.
- [ ] No se filtran direcciones ni identidades en eventos disponibles.
- [ ] `bunx tsc --noEmit`, ESLint de archivos modificados y `bun run build` pasan.
- [ ] Playwright cubre solicitud → aceptación → entrega → valoración → historial, además de reconexión/fallback SSE.

## Pruebas recomendadas

### Backend/DAO

- Historial por rol y paginación.
- Concurrencia: dos solicitudes simultáneas de valoración producen una sola fila.
- Transiciones y ownership: 403/404 correctos.
- Agregados: rating promedio y carreras completadas tras varias entregas.
- Moderación: cambios de estado lógico sin pérdida de auditoría.

### Frontend

- Solicitante: crear carrera, recibir estados, entregar y valorar.
- Mensajero: aceptar, completar y consultar historial/rating.
- SSE: actualización sin recarga, reconexión y fallback.
- Mapa: fuente activa y marcadores A/B actualizados por eventos.
- Accesibilidad: estrellas operables por teclado, estados con labels y foco visible.

### Comandos

```bash
bunx tsc --noEmit
bunx eslint app/page.tsx components/GoogleMapsDeliveryModal.tsx components/GoogleMapsMessengerModal.tsx components/MapLibreMap.tsx lib/hooks/useDeliveries.ts lib/db-delivery.ts app/api/deliveries app/api/admin/deliveries
bun run build
```

## Migración y despliegue

1. Revisar y aplicar `db/migrate_delivery_phase6.sql` en Neon.
2. Verificar restricciones, índices y datos existentes con consultas de integridad.
3. Implementar DAO y endpoints manteniendo compatible `GET /api/deliveries`.
4. Implementar SSE con fallback a polling.
5. Actualizar hooks y modales sin cambiar el contrato de `page.tsx` más allá de props existentes.
6. Ejecutar typecheck, lint y build.
7. Ejecutar smoke E2E con dos cuentas solicitante/mensajero y una cuenta admin.
8. Activar el stream en producción solo después de comprobar límites de duración y concurrencia del entorno de despliegue.

## Riesgos y decisiones

- **Serverless y conexiones largas:** Vercel u otro entorno serverless puede limitar la duración de un stream. Por eso el fallback a polling es obligatorio y el endpoint debe documentar su configuración de duración.
- **Cursores y relojes:** usar identificadores monotónicos o `(created_at, id)` para evitar perder eventos cuando dos registros comparten timestamp.
- **Agregados denormalizados:** `messengers_profiles.rating` y `completed_orders` son caché; ante inconsistencia se recalculan desde `delivery_reviews` y `delivery_requests`.
- **Privacidad en eventos:** reutilizar los DTO role-aware en vez de enviar filas crudas de PostgreSQL.
- **Sin dependencias nuevas:** SSE usa `EventSource` nativo y el backend puede implementar `text/event-stream` con APIs estándar de Next.js/Node.

## Documentos relacionados

- [Módulo de mensajería](messaging-module.md)
- [Referencia API](api.md)
- [Modelo de datos](data-model.md)
- [Arquitectura](architecture.md)
- [Roadmap](roadmap.md)
