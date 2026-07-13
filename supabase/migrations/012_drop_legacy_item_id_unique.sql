-- 012: eliminar unique legacy (db_source, item_id).
-- Motivo: item_id es informativo (sku numérico sin ceros a la izquierda) y puede
-- colisionar entre SKUs distintos (ej. "00100" y "100" → 100). La identidad real
-- del catálogo es (sku, db_source) — unique creado en la migración 009.
alter table public.inventory_master drop constraint if exists inventory_master_db_source_item_id_key;
