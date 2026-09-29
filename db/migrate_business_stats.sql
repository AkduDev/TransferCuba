-- TransferCuba — estadísticas de visitas (Fase 3).
--
-- Agregado por día y no una fila por evento: así la tabla crece una fila por
-- negocio y día en vez de sin límite, y una consulta de "últimos 30 días" lee
-- 30 filas en vez de recorrer un histórico entero.
--
-- No se guarda NADA de quien mira: ni IP, ni identificador, ni user-agent. Solo
-- un contador. Eso limita lo que se puede contar —son APERTURAS DE FICHA, no
-- visitantes únicos— y la interfaz lo dice con esas palabras en vez de vender
-- una precisión que no hay.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS business_view_daily (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  views       INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (business_id, day)
);

-- La consulta real es siempre "este negocio, últimos N días".
CREATE INDEX IF NOT EXISTS idx_vistas_por_negocio_dia
  ON business_view_daily (business_id, day DESC);
