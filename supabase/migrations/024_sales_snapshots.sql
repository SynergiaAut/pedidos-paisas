-- 024: Crear tabla sales_snapshots para comportamiento intradía
-- Idempotente: seguro de ejecutar varias veces.

create table if not exists public.sales_snapshots (
    id uuid default gen_random_uuid() primary key,
    captured_at timestamp with time zone default timezone('utc'::text, now()) not null,
    db_source text not null check (db_source in ('01', '02', 'ALL')),
    dia date not null,
    unidades numeric not null default 0,
    venta numeric not null default 0,
    costo numeric not null default 0,
    margen numeric not null default 0
);

-- Índice optimizado para auditoría intradía y series de tiempo por base
create index if not exists idx_sales_snapshots_lookup 
    on public.sales_snapshots (dia, db_source, captured_at desc);

-- RLS (Row Level Security) - Solo lectura para administradores
alter table public.sales_snapshots enable row level security;

drop policy if exists "Allow select for admin only" on public.sales_snapshots;
create policy "Allow select for admin only" on public.sales_snapshots
    for select using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- Las escrituras son realizadas por el backend con service_role
