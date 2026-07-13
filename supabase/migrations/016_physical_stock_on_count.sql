-- 016: Actualización síncrona de physical_stock y vista de consolidación analítica (TASK-D01 & TASK-D02).
-- Idempotente.

-- 1. Agregar columna last_counted_at a inventory_master si no existe
alter table public.inventory_master add column if not exists last_counted_at timestamptz;

-- 2. Crear índices de consulta para optimizar aggregaciones (TASK-D02)
create index if not exists inventory_counts_session_id_idx on public.inventory_counts(session_id);
create index if not exists inventory_counts_item_master_id_idx on public.inventory_counts(item_master_id);

-- 3. Modificar la función submit_mobile_count para actualizar physical_stock de forma síncrona
create or replace function public.submit_mobile_count(
    p_token text,
    p_item_id uuid,
    p_counted_qty numeric,
    p_counter_name text default null
) returns json language plpgsql security definer as $$
declare v_session record;
begin
    select id, status, expires_at into v_session
    from public.inventory_sessions where link_token = p_token;

    if not found then
        return json_build_object('success', false, 'message', 'Link inválido.');
    end if;
    if v_session.status <> 'counting' then
        return json_build_object('success', false, 'message', 'Este conteo ya fue cerrado.');
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

    -- 1. Insertar el log de conteo físico
    insert into public.inventory_counts (session_id, item_master_id, expected_stock, counted_quantity, counter_name, source)
    select v_session.id, im.id, im.system_stock, p_counted_qty, p_counter_name, 'mobile'
    from public.inventory_master im where im.id = p_item_id;

    -- 2. Actualizar de forma síncrona el stock físico en la tabla maestra
    update public.inventory_master
       set physical_stock = p_counted_qty,
           last_counted_at = now()
     where id = p_item_id;

    return json_build_object('success', true);
exception when others then
    return json_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.submit_mobile_count(text, uuid, numeric, text) to anon, authenticated;

-- 4. Crear la vista SQL de consolidación por sesión (TASK-D01)
create or replace view public.inventory_session_summary as
select
    s.id as session_id,
    s.name,
    s.mode,
    s.status,
    s.started_at,
    s.completed_at,
    count(c.id) as items_counted,
    count(c.id) filter (where c.counted_quantity <> c.expected_stock) as discrepancies,
    coalesce(sum(abs(c.counted_quantity - c.expected_stock) * coalesce(im.cost_avg, 0)), 0) as discrepancy_value
from public.inventory_sessions s
left join public.inventory_counts c on c.session_id = s.id
left join public.inventory_master im on im.id = c.item_master_id
group by s.id, s.name, s.mode, s.status, s.started_at, s.completed_at;

-- 5. Crear la vista SQL de productos problemáticos con descuadres recurrentes
create or replace view public.inventory_problem_products as
select
    c.item_master_id,
    im.sku,
    im.description,
    count(distinct c.session_id) as sesiones_con_descuadre,
    sum(abs(c.counted_quantity - c.expected_stock) * coalesce(im.cost_avg, 0)) as magnitud_acumulada
from public.inventory_counts c
join public.inventory_master im on im.id = c.item_master_id
where c.counted_quantity <> c.expected_stock
group by c.item_master_id, im.sku, im.description
having count(distinct c.session_id) > 1;

notify pgrst, 'reload schema';
