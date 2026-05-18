-- Drop existing table if it clashes
drop table if exists public.pending_invoices;

-- Create table for invoice print events
create table if not exists public.invoice_events (
    id uuid not null default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    
    -- Invoice 1 (DIAN)
    invoice_number_1 text not null,
    invoice_value_1 numeric not null default 0,
    
    -- Invoice 2 (Internal - Optional)
    invoice_number_2 text,
    invoice_value_2 numeric default 0,
    
    -- Products Data (JSONB array)
    -- Expected format: [{ name: "Burger", qty: 2, price: 15000, type: "DIAN" }]
    products jsonb default '[]'::jsonb,
    
    -- Status tracking
    status text not null default 'PENDING', -- PENDING, PROCESSED, IGNORED
    
    constraint invoice_events_pkey primary key (id)
);

-- Enable Realtime
alter publication supabase_realtime add table public.invoice_events;

-- Enable RLS
alter table public.invoice_events enable row level security;

-- Policies
create policy "Enable read access for all users"
on public.invoice_events for select
using (true);

create policy "Enable insert access for all users"
on public.invoice_events for insert
with check (true);

create policy "Enable update access for all users"
on public.invoice_events for update
using (true);
