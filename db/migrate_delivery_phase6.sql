-- TransferCuba — Fase 6: valoraciones de entrega.
--
-- Idempotente. Añade `delivery_reviews` y los índices que necesitan el
-- historial paginado y los agregados del mensajero.
--
-- `messengers_profiles.rating` y `completed_orders` existían desde la Fase 1
-- pero NUNCA se escribían: quedan como caché derivada de esta tabla y de
-- `delivery_requests`. La fuente de verdad de una valoración es esta tabla.

CREATE TABLE IF NOT EXISTS delivery_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id  UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'hidden', 'removed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Una valoración por carrera y solicitante. Es la barrera real contra el
  -- doble envío bajo concurrencia: el segundo INSERT choca aquí (23505) y el
  -- backend lo traduce a 409, sin depender de un SELECT previo.
  UNIQUE (delivery_id, requester_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_reviews_delivery
  ON delivery_reviews (delivery_id, created_at DESC);

-- Agregados del mensajero: promedio y conteo sobre las 'active'.
CREATE INDEX IF NOT EXISTS idx_delivery_reviews_messenger
  ON delivery_reviews (messenger_id, status, created_at DESC);

-- Historial paginado con cursor (requested_at, id). El índice lleva el orden
-- que pide la consulta, así que la paginación no ordena en memoria.
CREATE INDEX IF NOT EXISTS idx_delivery_requests_requester_hist
  ON delivery_requests (requester_id, requested_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_messenger_hist
  ON delivery_requests (messenger_id, requested_at DESC, id DESC);

-- `completed_orders` se puso a cero en su día y nunca se incrementó. Se
-- recalcula una vez desde las carreras ya entregadas para no partir de un dato
-- falso; a partir de aquí lo mantiene la transición a DELIVERED.
UPDATE messengers_profiles p
   SET completed_orders = COALESCE(sub.total, 0)
  FROM (
    SELECT messenger_id, COUNT(*) AS total
      FROM delivery_requests
     WHERE status = 'DELIVERED' AND messenger_id IS NOT NULL
     GROUP BY messenger_id
  ) sub
 WHERE sub.messenger_id = p.user_id
   AND p.completed_orders IS DISTINCT FROM COALESCE(sub.total, 0);
