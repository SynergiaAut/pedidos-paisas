-- 017: Orden de catálogo móvil, auto-cierre de sesión y estado pausado (TASK-M25 a TASK-M27 & TASK-M29).
-- Idempotente.

-- 1. Modificar get_mobile_session_items para ordenar por system_stock desc
create or replace function public.get_mobile_session_items(p_token text)
returns table(
    id uuid, 
    sku character varying, 
    description text, 
    classification text, 
    system_stock numeric,
    unit text
)
language plpgsql security definer as $$
declare v_session record;
begin
    select s.id, s.status, s.category_filter, s.expires_at into v_session
    from public.inventory_sessions s where s.link_token = p_token;

    if not found or v_session.status <> 'counting'
       or (v_session.expires_at is not null and v_session.expires_at < now()) then
        return;
    end if;

    return query
        select im.id, im.sku, im.description, im.classification, im.system_stock, im.unit
        from public.inventory_master im
        where im.is_service = false
          and (v_session.category_filter is null or im.classification = v_session.category_filter)
        order by im.system_stock desc, im.description;
end;
$$;

grant execute on function public.get_mobile_session_items(text) to anon, authenticated;

-- 2. Modificar submit_mobile_count para retornar counted_items y total_items en la respuesta de éxito
create or replace function public.submit_mobile_count(
    p_token text,
    p_item_id uuid,
    p_counted_qty numeric,
    p_counter_name text default null
) returns json language plpgsql security definer as $$
declare 
    v_session record;
    v_total_items int;
    v_counted_items int;
begin
    select id, status, expires_at, category_filter into v_session
    from public.inventory_sessions where link_token = p_token;

    if not found then
        return json_build_object('success', false, 'message', 'Link inválido.');
    end if;
    if v_session.status <> 'counting' then
        return json_build_object('success', false, 'message', 'Este conteo ya fue cerrado o pausado.');
    end if;
    if v_session.expires_at is not null and v_session.expires_at < now() then
        return json_build_object('success', false, 'message', 'Este link expiró.');
    end if;
    if p_counted_qty is null or p_counted_qty < 0 then
        return json_build_object('success', false, 'message', 'Cantidad inválida.');
    end if;
    if not exists (select 1 from public.inventory_master where id = p_item_id and is_service = false) then
        return json_build_object('success', false, 'message', 'Producto no válido o es un servicio.');
    end if;

    -- A. Insertar el log de conteo físico
    insert into public.inventory_counts (session_id, item_master_id, expected_stock, counted_quantity, counter_name, source)
    select v_session.id, im.id, im.system_stock, p_counted_qty, p_counter_name, 'mobile'
    from public.inventory_master im where im.id = p_item_id;

    -- B. Actualizar de forma síncrona el stock físico en la tabla maestra
    update public.inventory_master
       set physical_stock = p_counted_qty,
           last_counted_at = now()
     where id = p_item_id;

    -- C. Calcular total_items del alcance
    select count(*)::int into v_total_items 
    from public.inventory_master im 
    where im.is_service = false 
      and (v_session.category_filter is null or im.classification = v_session.category_filter);

    -- D. Calcular counted_items de la sesión
    select count(distinct item_master_id)::int into v_counted_items 
    from public.inventory_counts 
    where session_id = v_session.id;

    return json_build_object(
        'success', true, 
        'counted_items', v_counted_items, 
        'total_items', v_total_items
    );
exception when others then
    return json_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.submit_mobile_count(text, uuid, numeric, text) to anon, authenticated;

-- 3. Nueva función finish_mobile_count_session (autocierre validado server-side)
create or replace function public.finish_mobile_count_session(p_token text)
returns json language plpgsql security definer as $$
declare
    v_session record;
    v_total_items int;
    v_counted_items int;
    v_discrepancies int;
    v_duration_minutes int;
begin
    select id, name, status, started_at, completed_at, category_filter into v_session
    from public.inventory_sessions where link_token = p_token;

    if not found then
        return json_build_object('success', false, 'message', 'Link inválido.');
    end if;

    -- Calcular total_items del alcance
    select count(*)::int into v_total_items 
    from public.inventory_master im 
    where im.is_service = false 
      and (v_session.category_filter is null or im.classification = v_session.category_filter);

    -- Calcular counted_items de la sesión
    select count(distinct item_master_id)::int into v_counted_items 
    from public.inventory_counts 
    where session_id = v_session.id;

    if v_session.status = 'completed' then
        -- Retornar estadísticas existentes de forma idempotente
        select count(*)::int into v_discrepancies 
        from public.inventory_counts 
        where session_id = v_session.id 
          and counted_quantity <> expected_stock;

        select round(extract(epoch from (v_session.completed_at - v_session.started_at)) / 60)::int into v_duration_minutes;

        return json_build_object(
            'success', true,
            'items_counted', v_counted_items,
            'total_items', v_total_items,
            'discrepancies', v_discrepancies,
            'duration_minutes', coalesce(v_duration_minutes, 0)
        );
    end if;

    -- Solo autocierra si se contaron de verdad todos los ítems
    if v_counted_items < v_total_items then
        return json_build_object('success', false, 'message', 'Aún faltan productos por registrar en la sesión.');
    end if;

    -- Actualizar estado
    update public.inventory_sessions
       set status = 'completed',
           completed_at = now()
     where id = v_session.id;

    select count(*)::int into v_discrepancies 
    from public.inventory_counts 
    where session_id = v_session.id 
      and counted_quantity <> expected_stock;

    select round(extract(epoch from (now() - v_session.started_at)) / 60)::int into v_duration_minutes;

    return json_build_object(
        'success', true,
        'items_counted', v_counted_items,
        'total_items', v_total_items,
        'discrepancies', v_discrepancies,
        'duration_minutes', coalesce(v_duration_minutes, 0)
    );
exception when others then
    return json_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.finish_mobile_count_session(text) to anon, authenticated;

-- 4. Modificar get_mobile_session_info para soportar el estado 'paused'
create or replace function public.get_mobile_session_info(p_token text)
returns json language plpgsql security definer as $$
declare v_session record;
begin
    select id, name, status, expires_at into v_session
    from public.inventory_sessions where link_token = p_token;

    if not found then
        return json_build_object('valid', false, 'reason', 'not_found');
    end if;

    if v_session.status = 'paused' then
        return json_build_object('valid', false, 'reason', 'paused', 'name', v_session.name);
    end if;

    if v_session.status <> 'counting' then
        return json_build_object('valid', false, 'reason', 'closed', 'name', v_session.name);
    end if;

    if v_session.expires_at is not null and v_session.expires_at < now() then
        return json_build_object('valid', false, 'reason', 'expired', 'name', v_session.name);
    end if;

    return json_build_object('valid', true, 'name', v_session.name);
end;
$$;

grant execute on function public.get_mobile_session_info(text) to anon, authenticated;

-- 5. Crear la vista SQL de valorización y pérdidas de inventario
create or replace view public.inventory_valuation_summary as
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
