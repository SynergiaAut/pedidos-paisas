-- 026: Reglas de validación de calidad de datos en inventory_master.
-- Idempotente: agrega columnas de calidad y logs de auditoría sin interrumpir.

-- 1. Agregar columnas a inventory_master
alter table public.inventory_master add column if not exists needs_review boolean default false;
alter table public.inventory_master add column if not exists review_reason text;

-- 2. Índices para acelerar consultas del panel de Calidad de Datos
create index if not exists inventory_master_needs_review_idx on public.inventory_master (needs_review);
