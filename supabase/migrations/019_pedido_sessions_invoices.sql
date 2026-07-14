-- 019: Tablas para soporte de Captura de Pedidos por API de Millenium.
-- Idempotente: puede ejecutarse de forma segura en producción.

-- 1. Crear tabla public.pedido_sessions
create table if not exists public.pedido_sessions (
    id uuid default gen_random_uuid() primary key,
    id_vendedor numeric not null,
    watermark jsonb default '{}'::jsonb not null,
    opened_by uuid references auth.users(id) on delete set null,
    opened_at timestamp with time zone default timezone('utc'::text, now()) not null,
    status text default 'ABIERTA' not null constraint chk_pedido_session_status check (status in ('ABIERTA', 'CERRADA', 'CANCELADA')),
    order_id uuid references public.orders(id) on delete set null
);

-- Habilitar RLS en pedido_sessions
alter table public.pedido_sessions enable row level security;

-- Limpiar políticas existentes si es necesario (idempotencia)
drop policy if exists "pedido_sessions_select_authenticated" on public.pedido_sessions;
drop policy if exists "pedido_sessions_insert_authenticated" on public.pedido_sessions;
drop policy if exists "pedido_sessions_update_authenticated" on public.pedido_sessions;

-- Crear políticas para pedido_sessions
create policy "pedido_sessions_select_authenticated" on public.pedido_sessions
    for select to authenticated using (true);

create policy "pedido_sessions_insert_authenticated" on public.pedido_sessions
    for insert to authenticated with check (auth.uid() = opened_by);

create policy "pedido_sessions_update_authenticated" on public.pedido_sessions
    for update to authenticated using (true);


-- 2. Crear tabla public.pedido_invoices
create table if not exists public.pedido_invoices (
    id uuid default gen_random_uuid() primary key,
    session_id uuid references public.pedido_sessions(id) on delete cascade not null,
    db_source text not null constraint chk_pedido_invoice_db check (db_source in ('01', '02')),
    tipodoc text not null,
    numero text not null,
    fecha text not null,
    id_vendedor numeric not null,
    nombre_tercero text not null,
    total numeric default 0 not null,
    raw jsonb default '{}'::jsonb not null,
    detected_at timestamp with time zone default timezone('utc'::text, now()) not null,
    status text default 'DETECTADA' not null constraint chk_pedido_invoice_status check (status in ('DETECTADA', 'CONFIRMADA', 'IGNORADA')),
    constraint uq_pedido_invoice_natural_key unique (db_source, tipodoc, numero)
);

-- Habilitar RLS en pedido_invoices
alter table public.pedido_invoices enable row level security;

-- Limpiar políticas existentes si es necesario (idempotencia)
drop policy if exists "pedido_invoices_select_authenticated" on public.pedido_invoices;
drop policy if exists "pedido_invoices_insert_authenticated" on public.pedido_invoices;
drop policy if exists "pedido_invoices_update_authenticated" on public.pedido_invoices;

-- Crear políticas para pedido_invoices
create policy "pedido_invoices_select_authenticated" on public.pedido_invoices
    for select to authenticated using (true);

create policy "pedido_invoices_insert_authenticated" on public.pedido_invoices
    for insert to authenticated with check (true);

create policy "pedido_invoices_update_authenticated" on public.pedido_invoices
    for update to authenticated using (true);


-- 3. Habilitar Realtime para public.pedido_invoices de forma segura e idempotente
do $$
begin
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
          and schemaname = 'public' 
          and tablename = 'pedido_invoices'
    ) then
        alter publication supabase_realtime add table public.pedido_invoices;
    end if;
end;
$$;

-- 4. Notificar a PostgREST para recargar el esquema
notify pgrst, 'reload schema';
