-- 028: Soporte no destructivo para mesa multi-pedido en captura API.
-- Permite que Milena mantenga varios borradores abiertos al tiempo.

alter table public.pedido_sessions
    add column if not exists draft_label text,
    add column if not exists source_channel text default 'WHATSAPP' not null,
    add column if not exists customer_hint text,
    add column if not exists last_active_at timestamp with time zone default timezone('utc'::text, now()) not null;

create index if not exists idx_pedido_sessions_status_last_active
    on public.pedido_sessions (status, last_active_at desc);

notify pgrst, 'reload schema';
