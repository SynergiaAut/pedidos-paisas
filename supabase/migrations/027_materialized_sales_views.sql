-- 027: Crear Vista Materializada de Ventas Diarias para Optimización Analítica
-- y redefinir funciones RPC de agregación para lectura rápida.
-- Idempotente: seguro de ejecutar varias veces.

-- 1. Crear Vista Materializada si no existe
create materialized view if not exists public.mv_daily_sales_aggregation as
select 
    s.fecha,
    s.db_source,
    s.id_clasificacion,
    s.id_marca,
    s.sku,
    min(coalesce(s.descripcion, 'Sin descripción'))::text as descripcion,
    sum(s.cantidad)::numeric as total_unidades,
    sum(s.total)::numeric as total_venta,
    sum(s.total_costo)::numeric as total_costo,
    sum(case when s.sku not in ('2202007', '701042', '606042') then s.total else 0 end)::numeric as total_venta_margin,
    sum(case when s.sku not in ('2202007', '701042', '606042') then s.total_costo else 0 end)::numeric as total_costo_margin
from public.sales_lines s
group by s.fecha, s.db_source, s.id_clasificacion, s.id_marca, s.sku;

-- 2. Crear índices de rendimiento analítico
create unique index if not exists idx_mv_daily_sales_agg_unique on public.mv_daily_sales_aggregation(fecha, db_source, id_clasificacion, id_marca, sku);
create index if not exists idx_mv_daily_sales_agg_fecha on public.mv_daily_sales_aggregation(fecha);
create index if not exists idx_mv_daily_sales_agg_classif on public.mv_daily_sales_aggregation(id_clasificacion);

-- 3. Redefinir RPC: get_daily_sales_behavior
create or replace function public.get_daily_sales_behavior(
    start_date date,
    end_date date,
    classification_filter text default 'ALL'
)
returns table (
    fecha date,
    total_venta numeric,
    total_costo numeric,
    total_unidades numeric,
    total_venta_margin numeric,
    total_costo_margin numeric
)
language plpgsql
stable
security invoker
as $$
begin
    return query
    select 
        m.fecha,
        coalesce(sum(m.total_venta), 0)::numeric as total_venta,
        coalesce(sum(m.total_costo), 0)::numeric as total_costo,
        coalesce(sum(m.total_unidades), 0)::numeric as total_unidades,
        coalesce(sum(m.total_venta_margin), 0)::numeric as total_venta_margin,
        coalesce(sum(m.total_costo_margin), 0)::numeric as total_costo_margin
    from public.mv_daily_sales_aggregation m
    where m.fecha >= start_date 
      and m.fecha <= end_date
      and (classification_filter = 'ALL' or m.id_clasificacion = classification_filter)
    group by m.fecha
    order by m.fecha asc;
end;
$$;

-- 4. Redefinir RPC: get_top_sellers
create or replace function public.get_top_sellers(
    start_date date,
    end_date date,
    classification_filter text default 'ALL',
    max_limit int default 5
)
returns table (
    sku text,
    descripcion text,
    cantidad numeric,
    total numeric,
    margin_pct numeric
)
language plpgsql
stable
security invoker
as $$
begin
    return query
    select 
        m.sku,
        min(m.descripcion)::text as descripcion,
        sum(m.total_unidades)::numeric as cantidad,
        sum(m.total_venta)::numeric as total,
        case 
            when sum(m.total_venta) > 0 then ((sum(m.total_venta) - sum(m.total_costo)) / sum(m.total_venta)) * 100
            else 0 
        end::numeric as margin_pct
    from public.mv_daily_sales_aggregation m
    where m.fecha >= start_date 
      and m.fecha <= end_date
      and (classification_filter = 'ALL' or m.id_clasificacion = classification_filter)
    group by m.sku
    order by total desc
    limit max_limit;
end;
$$;

-- 5. Redefinir RPC: get_negative_margins
create or replace function public.get_negative_margins(
    start_date date,
    end_date date,
    classification_filter text default 'ALL',
    max_limit int default 5
)
returns table (
    sku text,
    descripcion text,
    total numeric,
    margin_pct numeric
)
language plpgsql
stable
security invoker
as $$
begin
    return query
    select 
        m.sku,
        min(m.descripcion)::text as descripcion,
        sum(m.total_venta)::numeric as total,
        case 
            when sum(m.total_venta) > 0 then ((sum(m.total_venta) - sum(m.total_costo)) / sum(m.total_venta)) * 100
            else 0 
        end::numeric as margin_pct
    from public.mv_daily_sales_aggregation m
    where m.fecha >= start_date 
      and m.fecha <= end_date
      and m.sku not in ('2202007', '701042', '606042')
      and (classification_filter = 'ALL' or m.id_clasificacion = classification_filter)
    group by m.sku
    having (
        case 
            when sum(m.total_venta) > 0 then ((sum(m.total_venta) - sum(m.total_costo)) / sum(m.total_venta)) * 100
            else 0 
        end
    ) < 10
    order by margin_pct asc
    limit max_limit;
end;
$$;

-- 6. Redefinir RPC: get_negative_margin_count
create or replace function public.get_negative_margin_count(
    start_date date,
    end_date date,
    classification_filter text default 'ALL'
)
returns bigint
language plpgsql
stable
security invoker
as $$
declare
    cnt bigint;
begin
    select count(*)
    into cnt
    from (
        select m.sku
        from public.mv_daily_sales_aggregation m
        where m.fecha >= start_date 
          and m.fecha <= end_date
          and m.sku not in ('2202007', '701042', '606042')
          and (classification_filter = 'ALL' or m.id_clasificacion = classification_filter)
        group by m.sku
        having sum(m.total_venta) > 0 and (sum(m.total_venta) - sum(m.total_costo)) < 0
    ) sub;
    return cnt;
end;
$$;

-- Otorgar permisos de ejecución explícitamente
grant execute on function public.get_daily_sales_behavior(date, date, text) to authenticated;
grant execute on function public.get_top_sellers(date, date, text, int) to authenticated;
grant execute on function public.get_negative_margins(date, date, text, int) to authenticated;
grant execute on function public.get_negative_margin_count(date, date, text) to authenticated;

-- 7. Función RPC para refrescar la vista materializada concurrentemente
create or replace function public.refresh_sales_materialized_view()
returns void
language plpgsql
security definer
as $$
begin
    refresh materialized view concurrently public.mv_daily_sales_aggregation;
end;
$$;

grant execute on function public.refresh_sales_materialized_view() to authenticated, service_role;
