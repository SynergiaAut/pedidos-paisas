-- Migración: Reconciliación de descuadres al cierre de sesión (TASK-D33)

-- 1. Agregar columnas a inventory_counts
alter table public.inventory_counts 
add column system_stock_at_close numeric null,
add column reconciliation_note text null;

-- 2. Recrear las vistas SQL para considerar el stock al cierre (reconciliación)
drop view if exists public.inventory_valuation_summary cascade;
drop view if exists public.inventory_session_summary cascade;

create view public.inventory_session_summary as
select
    s.id as session_id,
    s.name,
    s.mode,
    s.status,
    s.started_at,
    s.completed_at,
    s.category_filter,
    count(c.id) as items_counted,
    count(c.id) filter (where c.counted_quantity <> coalesce(c.system_stock_at_close, c.expected_stock)) as discrepancies,
    coalesce(sum(abs(c.counted_quantity - coalesce(c.system_stock_at_close, c.expected_stock)) * coalesce(im.cost_avg, 0)), 0) as discrepancy_value
from public.inventory_sessions s
left join public.inventory_counts c on c.session_id = s.id
left join public.inventory_master im on im.id = c.item_master_id
group by s.id, s.name, s.mode, s.status, s.started_at, s.completed_at, s.category_filter;

create view public.inventory_valuation_summary as
with totals as (
    select
        coalesce(sum(system_stock * coalesce(cost_avg, 0)), 0) as total_inventory_value,
        coalesce(sum(case when physical_stock is not null then system_stock * coalesce(cost_avg, 0) else 0 end), 0) as counted_inventory_value
    from public.inventory_master
    where is_service = false
),
discrepancies as (
    select
        coalesce(sum(discrepancy_value), 0) as total_discrepancy_value
    from public.inventory_session_summary
    where status = 'completed'
)
select
    t.total_inventory_value,
    t.counted_inventory_value,
    d.total_discrepancy_value,
    case 
        when t.counted_inventory_value > 0 then round((d.total_discrepancy_value / t.counted_inventory_value) * 100, 2)
        else 0 
    end as loss_percentage
from totals t, discrepancies d;

notify pgrst, 'reload schema';
