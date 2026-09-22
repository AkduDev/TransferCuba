-- TransferCuba — red de seguridad para businesses.last_updated_date.
--
-- La columna es NOT NULL y no tenía DEFAULT, mientras que el INSERT de
-- `insertBusiness` (lib/db.ts) no la aportaba: cada alta de negocio moría con
-- "null value in column last_updated_date violates not-null constraint", el
-- error se confundía con una caída de PostgreSQL y la API respondía 201 sin
-- haber guardado nada.
--
-- El arreglo de fondo va en el código (la columna ya viaja en el INSERT). Esto
-- es defensa en profundidad: cualquier otra ruta de escritura que la olvide
-- obtiene la marca de tiempo en vez de reventar.
--
-- Idempotente.

ALTER TABLE businesses ALTER COLUMN last_updated_date SET DEFAULT NOW();
