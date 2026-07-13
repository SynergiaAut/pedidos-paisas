-- 014: Conteo móvil por link (TASK-011). Extiende inventory_sessions/inventory_counts
-- y cierra RLS pendiente sobre ambas tablas.

-- 1. Columnas nuevas en inventory_sessions
alter table public.inventory_sessions add column if not exists link_token text;
alter table public.inventory_sessions add column if not exists expires_at timestamptz;
alter table public.inventory_sessions add column if not exists category_filter text;
alter table public.inventory_sessions add column if not exists created_by uuid references auth.users(id);
alter table public.inventory_sessions add column if not exists mode text default 'desktop'; -- 'desktop' | 'mobile_link'

create unique index if not exists inventory_sessions_link_token_key
    on public.inventory_sessions (link_token) where link_token is not null;

-- 2. Columnas nuevas en inventory_counts
alter table public.inventory_counts add column if not exists counter_name text;
alter table public.inventory_counts add column if not exists source text default 'desktop'; -- 'desktop' | 'mobile'
alter table public.inventory_counts add column if not exists expected_stock numeric;

-- 3. RLS: asegura ambas tablas
alter table public.inventory_sessions enable row level security;
alter table public.inventory_counts enable row level security;

-- Limpiar policies previas que choquen o sean redundantes
drop policy if exists "Full access to sessions for authenticated users" on public.inventory_sessions;
drop policy if exists "Full access to counts for authenticated users" on public.inventory_counts;
drop policy if exists inventory_sessions_authenticated on public.inventory_sessions;
drop policy if exists inventory_counts_authenticated on public.inventory_counts;

-- Crear políticas estándar para usuarios autenticados
create policy inventory_sessions_authenticated on public.inventory_sessions
    for all to authenticated using (true) with check (true);

create policy inventory_counts_authenticated on public.inventory_counts
    for all to authenticated using (true) with check (true);

-- 4. RPC: info de la sesión (para la pantalla /conteo/[token])
create or replace function public.get_mobile_session_info(p_token text)
returns json language plpgsql security definer as $$
declare v_session record;
begin
    select id, name, status, expires_at into v_session
    from public.inventory_sessions where link_token = p_token;

    if not found then
        return json_build_object('valid', false, 'reason', 'not_found');
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

-- 5. RPC: catálogo del conteo (sin costo/precio — solo lo necesario para contar)
drop function if exists public.get_mobile_session_items(text);

create or replace function public.get_mobile_session_items(p_token text)
returns table(id uuid, sku character varying, description text, classification text, system_stock numeric)
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
        select im.id, im.sku, im.description, im.classification, im.system_stock
        from public.inventory_master im
        where im.is_service = false
          and (v_session.category_filter is null or im.classification = v_session.category_filter)
        order by im.description;
end;
$$;

-- 6. RPC: insertar conteo físico (insert-only, valida token/estado/expiración/ítem)
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

    insert into public.inventory_counts (session_id, item_master_id, expected_stock, counted_quantity, counter_name, source)
    select v_session.id, im.id, im.system_stock, p_counted_qty, p_counter_name, 'mobile'
    from public.inventory_master im where im.id = p_item_id;

    return json_build_object('success', true);
exception when others then
    return json_build_object('success', false, 'message', sqlerrm);
end;
$$;

-- 7. Grants mínimos: solo ejecución de las 3 funciones, nada de tablas.
grant execute on function public.get_mobile_session_info(text) to anon, authenticated;
grant execute on function public.get_mobile_session_items(text) to anon, authenticated;
grant execute on function public.submit_mobile_count(text, uuid, numeric, text) to anon, authenticated;

notify pgrst, 'reload schema';
