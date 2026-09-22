-- Migración: agregar columna has_delivery a businesses
-- Fase 7 — Delivery visible desde el mapa

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN NOT NULL DEFAULT false;

-- Negocios existentes: asumir false por defecto
UPDATE businesses SET has_delivery = false WHERE has_delivery IS NULL;
