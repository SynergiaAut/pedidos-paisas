-- 020: Repara la deriva de esquema tras migrar a Fast_Order_DB (Nano).
-- El CRM y el trigger 002 usan columnas de clients y una función RFM que
-- nunca se versionaron (existían solo en la base anterior). Esto las recrea.
-- Idempotente: seguro de ejecutar varias veces.

-- 1. Columnas de CRM/RFM que faltan en public.clients
alter table public.clients
    add column if not exists status text default 'ACTIVE',
    add column if not exists lifetime_value numeric default 0,
    add column if not exists average_order_value numeric default 0,
    add column if not exists last_interaction_date timestamp with time zone,
    add column if not exists rfm_segment text,
    add column if not exists rfm_score integer;

-- Índice para el orden por valor del cliente (usado por el listado del CRM)
create index if not exists clients_lifetime_value_idx
    on public.clients using btree (lifetime_value);

-- 2. Asegurar el vínculo orders -> clients (de la migración 002, por si no se aplicó)
alter table public.orders
    add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists idx_orders_client_id on public.orders(client_id);

-- 3. Recrear el trigger que mantiene las métricas del cliente (de 002).
--    La llamada a calculate_rfm_score queda protegida: si la función no existe,
--    no rompe (el score RFM quedará nulo hasta restaurar esa función).
create or replace function update_client_after_order()
returns trigger as $$
begin
    if new.client_id is not null then
        update clients set
            total_orders = (
                select count(*) from orders where client_id = new.client_id
            ),
            last_order_date = (
                select max(created_at) from orders where client_id = new.client_id
            ),
            lifetime_value = (
                select coalesce(sum(total_value), 0)
                from orders where client_id = new.client_id and status = 'ENTREGADO'
            ),
            average_order_value = (
                select coalesce(avg(total_value), 0)
                from orders where client_id = new.client_id and status = 'ENTREGADO'
            ),
            last_interaction_date = now()
        where id = new.client_id;

        if exists (select 1 from pg_proc where proname = 'calculate_rfm_score') then
            perform calculate_rfm_score(new.client_id);
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_client_after_order on orders;
create trigger trigger_update_client_after_order
    after insert or update of status, total_value, client_id on orders
    for each row
    execute function update_client_after_order();
