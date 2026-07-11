-- 009: inventory_master listo para el sync desde API Flex CRM (2 bases).
-- Idempotente: puede correrse sobre la tabla existente (creada via dashboard) o en un entorno limpio.
-- Ver .spec/integracion-api-2bd/plan.md

-- 1. Tabla base (solo si no existe — en prod ya existe)
create table if not exists public.inventory_master (
    id uuid primary key default gen_random_uuid(),
    db_source text not null,
    item_id bigint,
    sku text not null,
    barcode text,
    description text,
    system_stock numeric default 0,
    physical_stock numeric,
    last_sync_at timestamptz
);

-- 2. Columnas nuevas del sync (payload real verificado 2026-07-11)
alter table public.inventory_master add column if not exists cost_avg numeric default 0;
alter table public.inventory_master add column if not exists classification text;
alter table public.inventory_master add column if not exists brand text;
alter table public.inventory_master add column if not exists unit text;
alter table public.inventory_master add column if not exists stock_by_warehouse jsonb default '[]'::jsonb;
alter table public.inventory_master add column if not exists is_service boolean default false;
alter table public.inventory_master add column if not exists last_sync_at timestamptz;

-- 3. Unique index requerido por el upsert idempotente (onConflict: sku,db_source)
-- Si falla por duplicados preexistentes, inspecciónalos con:
--   select sku, db_source, count(*) from public.inventory_master group by 1,2 having count(*) > 1;
create unique index if not exists inventory_master_sku_db_source_key
    on public.inventory_master (sku, db_source);

-- 4. Índices de consulta de la UI (búsqueda y filtro por base)
create index if not exists inventory_master_db_source_idx on public.inventory_master (db_source);
create index if not exists inventory_master_barcode_idx on public.inventory_master (barcode);

-- NOTA RLS: las policies de esta tabla se definen en la tarea de seguridad S2
-- (docs/auditorias/2026-07-11-auditoria.md). Esta migración no toca RLS.
