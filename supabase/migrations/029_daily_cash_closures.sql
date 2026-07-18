-- 029: Cierre operativo de caja por dia.
-- Mantiene el cuadre separado de orders para no alterar despacho ni pedidos.

create table if not exists public.daily_cash_closures (
    id uuid default gen_random_uuid() primary key,
    business_date date not null unique,
    expected_total numeric default 0 not null,
    counted_cash numeric default 0 not null,
    counted_transfer numeric default 0 not null,
    counted_card numeric default 0 not null,
    expenses numeric default 0 not null,
    difference numeric default 0 not null,
    notes text,
    status text default 'BORRADOR' not null check (status in ('BORRADOR', 'CERRADO')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    closed_at timestamp with time zone
);

create index if not exists idx_daily_cash_closures_business_date
    on public.daily_cash_closures (business_date desc);

alter table public.daily_cash_closures enable row level security;

drop policy if exists "Enable access for all users" on public.daily_cash_closures;
create policy "Enable access for all users" on public.daily_cash_closures
    for all using (true) with check (true);

notify pgrst, 'reload schema';
