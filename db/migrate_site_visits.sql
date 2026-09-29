-- TransferCuba — contador de visitas al sitio (Fase 0 del plan comercial).
--
-- Se construye en casa y no con un tercero por tres razones: no hay que añadir
-- dependencias, no hay script externo que cargar desde Cuba, y no se guarda
-- NADA de quien visita — ni IP, ni cookie, ni identificador. Solo un contador
-- por día y ruta.
--
-- Eso acota lo que se puede afirmar: son APERTURAS DE PÁGINA, no visitantes
-- únicos, y sin referente ni país. Si algún día hace falta eso, Vercel Web
-- Analytics se enciende desde el panel y sirve el script desde el mismo
-- dominio; esto no pretende sustituirlo, solo dejar de volar a ciegas.
--
-- Agregado por día, como `business_view_daily`: crece una fila por ruta y día.
-- Idempotente.

CREATE TABLE IF NOT EXISTS site_visit_daily (
  day    DATE NOT NULL,
  path   TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0 CHECK (visits >= 0),
  PRIMARY KEY (day, path)
);

CREATE INDEX IF NOT EXISTS idx_visitas_por_dia
  ON site_visit_daily (day DESC);
