-- Add products JSONB column to orders table to store line items from invoices
alter table public.orders 
add column if not exists products jsonb default '[]'::jsonb;
