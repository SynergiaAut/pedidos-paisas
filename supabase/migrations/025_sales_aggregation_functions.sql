-- 025: Funciones SQL/RPC para agregación eficiente de comportamiento de productos.
-- Evita el tope de 1.000 filas de PostgREST calculando agregados y rankings en el servidor.
-- Idempotente: seguro de ejecutar varias veces.

-- 1. Agregado diario de ventas
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
        s.fecha,
        coalesce(sum(s.total), 0)::numeric as total_venta,
        coalesce(sum(s.total_costo), 0)::numeric as total_costo,
        coalesce(sum(s.cantidad), 0)::numeric as total_unidades,
        coalesce(sum(case when s.sku not in ('2202007', '701042', '606042') then s.total else 0 end), 0)::numeric as total_venta_margin,
        coalesce(sum(case when s.sku not in ('2202007', '701042', '606042') then s.total_costo else 0 end), 0)::numeric as total_costo_margin
    from public.sales_lines s
    where s.fecha >= start_date 
      and s.fecha <= end_date
      and (classification_filter = 'ALL' or s.id_clasificacion = classification_filter)
    group by s.fecha
    order by s.fecha asc;
end;
$$;

-- 2. Ranking de más vendidos (Top Sellers)
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
        s.sku,
        min(s.descripcion)::text as descripcion,
        sum(s.cantidad)::numeric as cantidad,
        sum(s.total)::numeric as total,
        case 
            when sum(s.total) > 0 then ((sum(s.total) - sum(s.total_costo)) / sum(s.total)) * 100
            else 0 
        end::numeric as margin_pct
    from public.sales_lines s
    where s.fecha >= start_date 
      and s.fecha <= end_date
      and (classification_filter = 'ALL' or s.id_clasificacion = classification_filter)
    group by s.sku
    order by total desc
    limit max_limit;
end;
$$;

-- 3. Productos con márgenes críticos (< 10%)
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
        s.sku,
        min(s.descripcion)::text as descripcion,
        sum(s.total)::numeric as total,
        case 
            when sum(s.total) > 0 then ((sum(s.total) - sum(s.total_costo)) / sum(s.total)) * 100
            else 0 
        end::numeric as margin_pct
    from public.sales_lines s
    where s.fecha >= start_date 
      and s.fecha <= end_date
      and s.sku not in ('2202007', '701042', '606042')
      and (classification_filter = 'ALL' or s.id_clasificacion = classification_filter)
    group by s.sku
    having (
        case 
            when sum(s.total) > 0 then ((sum(s.total) - sum(s.total_costo)) / sum(s.total)) * 100
            else 0 
        end
    ) < 10
    order by margin_pct asc
    limit max_limit;
end;
$$;

-- 4. Conteo de SKUs con margen de venta neto negativo (< 0%)
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
        select s.sku
        from public.sales_lines s
        where s.fecha >= start_date 
          and s.fecha <= end_date
          and s.sku not in ('2202007', '701042', '606042')
          and (classification_filter = 'ALL' or s.id_clasificacion = classification_filter)
        group by s.sku
        having sum(s.total) > 0 and (sum(s.total) - sum(s.total_costo)) < 0
    ) sub;
    return cnt;
end;
$$;

-- 5. Listado de Dead Stock (stock > 0 y 0 ventas en el período)
create or replace function public.get_dead_stock(
    start_date date,
    end_date date,
    classification_filter text default 'ALL',
    max_limit int default 5
)
returns table (
    sku text,
    descripcion text,
    system_stock numeric,
    classification text,
    brand text
)
language plpgsql
stable
security invoker
as $$
begin
    return query
    select 
        i.sku::text,
        coalesce(i.description, 'Sin descripción')::text as descripcion,
        coalesce(i.system_stock, 0)::numeric as system_stock,
        coalesce(i.classification, 'General')::text as classification,
        coalesce(i.brand, 'Genérica')::text as brand
    from public.inventory_master i
    where i.is_service = false
      and coalesce(i.system_stock, 0) > 0
      and (classification_filter = 'ALL' or i.classification = classification_filter)
      and not exists (
          select 1 
          from public.sales_lines s
          where s.sku = i.sku
            and s.fecha >= start_date
            and s.fecha <= end_date
      )
    order by i.system_stock desc
    limit max_limit;
end;
$$;

-- 6. Conteo total de SKUs en Dead Stock
create or replace function public.get_dead_stock_count(
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
    return (
        select count(*)
        from public.inventory_master i
        where i.is_service = false
          and coalesce(i.system_stock, 0) > 0
          and (classification_filter = 'ALL' or i.classification = classification_filter)
          and not exists (
              select 1 
              from public.sales_lines s
              where s.sku = i.sku
                and s.fecha >= start_date
                and s.fecha <= end_date
          )
    );
end;
$$;

-- Permisos
grant execute on function public.get_daily_sales_behavior(date, date, text) to authenticated;
grant execute on function public.get_top_sellers(date, date, text, int) to authenticated;
grant execute on function public.get_negative_margins(date, date, text, int) to authenticated;
grant execute on function public.get_negative_margin_count(date, date, text) to authenticated;
grant execute on function public.get_dead_stock(date, date, text, int) to authenticated;
grant execute on function public.get_dead_stock_count(date, date, text) to authenticated;
