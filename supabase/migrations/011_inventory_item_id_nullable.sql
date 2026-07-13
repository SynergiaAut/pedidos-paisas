-- 011: item_id pasa a nullable.
-- Motivo: item_id es un legado numérico de la UI; la clave real del catálogo es (sku, db_source).
-- Algunos SKUs de Milenium no son numéricos y el sync les asigna item_id = null.
alter table public.inventory_master alter column item_id drop not null;
