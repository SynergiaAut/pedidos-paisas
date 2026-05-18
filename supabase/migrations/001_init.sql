-- 1. Create the simplified orders table
create table public.orders (
    id uuid default gen_random_uuid() primary key,
    public_id text not null,
    -- e.g. 'PED-4829A'
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    status text default 'TOMADO',
    -- 'TOMADO', 'DESPACHO', 'PAGADO'
    client_name text,
    total_value numeric default 0,
    observations text,
    -- JSONB column to store flexible invoice data (code, value) without strict schema constraints
    invoices_data jsonb default '[]'::jsonb
);
-- 2. Enable Realtime for this table (Critical for the Dispatch Screen)
alter publication supabase_realtime
add table public.orders;
-- 3. Disable Row Level Security (RLS) for Development Speed
-- WARNING: In production, we should enable this and add auth policies.
-- For now, this allows the app to read/write without complex auth setup.
alter table public.orders enable row level security;
create policy "Enable read access for all users" on public.orders for
select to public using (true);
create policy "Enable insert access for all users" on public.orders for
insert to public with check (true);
create policy "Enable update access for all users" on public.orders for
update to public using (true);