-- 021: Versionamiento de CRM (Tablas client_notes, client_interactions, client_tags y funciones RFM)
-- Idempotente: seguro de ejecutar varias veces.

-- 1. Tabla de notas del cliente
create table if not exists public.client_notes (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    client_id uuid references public.clients(id) on delete cascade not null,
    note text not null,
    note_type text default 'GENERAL' not null
);
alter table public.client_notes enable row level security;
drop policy if exists "Enable access for all users" on public.client_notes;
create policy "Enable access for all users" on public.client_notes for all using (true) with check (true);

-- 2. Tabla de interacciones del cliente
create table if not exists public.client_interactions (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    client_id uuid references public.clients(id) on delete cascade not null,
    type text not null, -- 'LLAMADA', 'VISITA', 'VENTA', etc.
    description text,
    created_by uuid
);
alter table public.client_interactions enable row level security;
drop policy if exists "Enable access for all users" on public.client_interactions;
create policy "Enable access for all users" on public.client_interactions for all using (true) with check (true);

-- 3. Tabla de etiquetas del cliente
create table if not exists public.client_tags (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    client_id uuid references public.clients(id) on delete cascade not null,
    tag text not null
);
alter table public.client_tags enable row level security;
drop policy if exists "Enable access for all users" on public.client_tags;
create policy "Enable access for all users" on public.client_tags for all using (true) with check (true);

-- 4. Función de cálculo de RFM individual
create or replace function public.calculate_rfm_score(p_client_id uuid)
returns void as $$
declare
    v_recency_days integer;
    v_frequency integer;
    v_monetary numeric;
    v_r integer;
    v_f integer;
    v_m integer;
    v_score integer;
    v_segment text;
begin
    -- Obtener métricas básicas del cliente
    select 
        coalesce(extract(day from (now() - last_order_date)), 9999)::integer,
        coalesce(total_orders, 0),
        coalesce(lifetime_value, 0)
    into v_recency_days, v_frequency, v_monetary
    from public.clients
    where id = p_client_id;

    if not found then
        return;
    end if;

    -- Calcular Score de Recencia (R)
    if v_recency_days <= 15 then v_r := 5;
    elsif v_recency_days <= 30 then v_r := 4;
    elsif v_recency_days <= 60 then v_r := 3;
    elsif v_recency_days <= 120 then v_r := 2;
    else v_r := 1;
    end if;

    -- Calcular Score de Frecuencia (F)
    if v_frequency >= 12 then v_f := 5;
    elsif v_frequency >= 6 then v_f := 4;
    elsif v_frequency >= 3 then v_f := 3;
    elsif v_frequency >= 2 then v_f := 2;
    else v_f := 1;
    end if;

    -- Calcular Score de Monto (M)
    if v_monetary >= 1000000 then v_m := 5;
    elsif v_monetary >= 500000 then v_m := 4;
    elsif v_monetary >= 200000 then v_m := 3;
    elsif v_monetary >= 50000 then v_m := 2;
    else v_m := 1;
    end if;

    -- RFM Score final como número de 3 dígitos (ej: 543)
    v_score := (v_r * 100) + (v_f * 10) + v_m;

    -- Asignar el segmento basado en R y F
    if v_r >= 4 and v_f >= 4 then
        v_segment := 'CAMPEONES';
    elsif v_r >= 3 and v_f >= 3 then
        v_segment := 'LEALES';
    elsif v_r >= 4 and v_f >= 1 then
        v_segment := 'PROMETEDORES';
    elsif v_r = 3 and v_f <= 2 then
        v_segment := 'NECESITA ATENCION';
    elsif v_r = 2 and v_f >= 3 then
        v_segment := 'EN RIESGO';
    elsif v_r = 2 and v_f <= 2 then
        v_segment := 'HIBERNANDO';
    else
        v_segment := 'PERDIDO';
    end if;

    -- Actualizar el registro del cliente
    update public.clients set
        rfm_score = v_score,
        rfm_segment = v_segment
    where id = p_client_id;
end;
$$ language plpgsql;

-- 5. Función de cálculo de RFM masivo
create or replace function public.update_all_rfm_scores()
returns void as $$
declare
    r record;
begin
    for r in select id from public.clients loop
        perform public.calculate_rfm_score(r.id);
    end loop;
end;
$$ language plpgsql;

-- 6. Agregar orders a la publicación supabase_realtime de forma segura
do $$
begin
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
    ) then
        alter publication supabase_realtime add table public.orders;
    end if;
end $$;
