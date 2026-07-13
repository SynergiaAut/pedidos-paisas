-- 015: Conteo móvil en tiempo real y soporte para unidad de medida (TASK-M19 & TASK-M20).
-- Idempotente: puede ejecutarse de forma segura en producción.

-- 1. Agregar la tabla public.inventory_counts a la publicación supabase_realtime
do $$
begin
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
          and schemaname = 'public' 
          and tablename = 'inventory_counts'
    ) then
        alter publication supabase_realtime add table public.inventory_counts;
    end if;
end;
$$;

-- 2. Modificar la función get_mobile_session_items para incluir la unidad de medida (unit)
drop function if exists public.get_mobile_session_items(text);

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
        order by im.description;
end;
$$;

grant execute on function public.get_mobile_session_items(text) to anon, authenticated;

notify pgrst, 'reload schema';
