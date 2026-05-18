-- Create delivery_drivers table
create table if not exists public.delivery_drivers (
    id uuid not null default gen_random_uuid (),
    created_at timestamp with time zone not null default now(),
    full_name text not null,
    phone text null,
    vehicle_plate text null,
    is_active boolean not null default true,
    constraint delivery_drivers_pkey primary key (id)
);
-- Add RLS policies for drivers
alter table public.delivery_drivers enable row level security;
create policy "Enable read access for all users" on public.delivery_drivers for
select using (true);
create policy "Enable insert for all users" on public.delivery_drivers for
insert with check (true);
create policy "Enable update for all users" on public.delivery_drivers for
update using (true);
-- Add driver_id to orders if it doesn't exist
do $$ begin if not exists (
    select 1
    from information_schema.columns
    where table_name = 'orders'
        and column_name = 'driver_id'
) then
alter table public.orders
add column driver_id uuid null references public.delivery_drivers(id);
end if;
end $$;