-- 022: Corregir descuadres falsos por el default 0 de physical_stock.
--
-- Contexto: la columna public.inventory_master.physical_stock quedó (por deriva
-- de esquema) con DEFAULT 0 en la base real. El sync "nunca escribe physical_stock",
-- así que cada producto nuevo nace con 0. Al entrar BD2, sus ~2.500 productos
-- nacieron con physical_stock = 0, y el sistema lo interpreta como "contado = 0"
-- → cientos de descuadres FALSOS (físico 0 ≠ stock del sistema).
--
-- Regla real: physical_stock lo escriben SOLO los conteos (inventory_counts).
-- Un producto sin conteo debe tener physical_stock = NULL ("sin contar").
--
-- Idempotente: seguro de ejecutar varias veces.

-- 1. Quitar el default heredado (si no existe, es no-op)
alter table public.inventory_master alter column physical_stock drop default;

-- 2. Anular los 0 que NO provienen de un conteo real (nunca aparecen en inventory_counts).
--    Los productos genuinamente contados (aunque sea a 0) se conservan intactos.
update public.inventory_master m
set physical_stock = null
where m.physical_stock = 0
  and not exists (
    select 1 from public.inventory_counts c where c.item_master_id = m.id
  );
