-- 021: Crear tabla sales_lines para el análisis de comportamiento de productos
-- Idempotente: seguro de ejecutar varias veces.

create table if not exists public.sales_lines (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    db_source text not null check (db_source in ('01', '02')),
    tipodoc text not null,
    numero text not null,
    fecha date not null,
    sku text not null,
    descripcion text,
    id_clasificacion text,
    id_marca text,
    id_bodega text,
    id_vendedor integer,
    cantidad numeric not null,
    precio numeric not null,
    total numeric not null,
    costo_unit numeric not null,
    total_costo numeric not null,
    margen numeric not null,
    synced_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint sales_lines_natural_key unique (db_source, tipodoc, numero, sku)
);

-- Índices recomendados para consultas rápidas de agregación y análisis
create index if not exists idx_sales_lines_sku on public.sales_lines(sku);
create index if not exists idx_sales_lines_db_source_fecha on public.sales_lines(db_source, fecha);
create index if not exists idx_sales_lines_fecha on public.sales_lines(fecha);

-- RLS (Row Level Security) - Solo lectura para administradores
alter table public.sales_lines enable row level security;

drop policy if exists "Allow select for admin only" on public.sales_lines;
create policy "Allow select for admin only" on public.sales_lines
    for select using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- Nota: Las escrituras (insert/update/delete) se realizan por el backend 
-- a través del cliente admin (service_role) que salta RLS por diseño.
