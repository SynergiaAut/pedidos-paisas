-- 013: baseline de physical_stock.
-- La tabla original dejó physical_stock = 0 por defecto en todas las filas,
-- lo que genera falsos "descuadres" (0 registrado ≠ stock del sistema).
-- Semántica correcta: NULL = "nunca contado". Solo los conteos cíclicos
-- (inventory_counts) escriben physical_stock de aquí en adelante.
-- Se ejecuta UNA VEZ, antes de que existan conteos reales.
update public.inventory_master set physical_stock = null where physical_stock = 0;
