-- Create clients table
create table if not exists public.clients (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    full_name text not null,
    phone text,
    email text,
    address text,
    total_orders integer default 0,
    last_order_date timestamp with time zone
);
-- Add indexes for fast search
create index if not exists clients_full_name_idx on public.clients using btree (full_name);
create index if not exists clients_phone_idx on public.clients using btree (phone);
-- Add RLS policies (adjust as needed, currently allowing open access for demo/internal tools)
alter table public.clients enable row level security;
create policy "Enable read access for all users" on public.clients for
select using (true);
create policy "Enable insert access for all users" on public.clients for
insert with check (true);
create policy "Enable update access for all users" on public.clients for
update using (true);