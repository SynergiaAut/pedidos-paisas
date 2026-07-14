-- 021: KPI de unidades en stock.
-- Suma system_stock de los ítems reales (excluye servicios), agrupada por base.
-- Se usa una función para sumar en el servidor y evitar el tope de filas de PostgREST.
-- Idempotente: seguro de ejecutar varias veces.

create or replace function public.get_stock_units()
returns table (db_source text, units numeric)
language sql
stable
security invoker
as $$
    select db_source, coalesce(sum(system_stock), 0)::numeric as units
    from public.inventory_master
    where is_service = false
    group by db_source;
$$;

grant execute on function public.get_stock_units() to authenticated;
