-- TransferCuba — aceptación de Términos y Condiciones en el alta.
-- Migración idempotente: registra cuándo cada usuario aceptó los términos.
-- Sin esta marca, el alta se rechaza en POST /api/account/register.

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
