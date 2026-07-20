-- Roles operativos para Fast Order.
-- Mantiene roles heredados para no romper cuentas existentes creadas en fases tempranas.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
    check (
        role in (
            'admin',
            'user',
            'pedidos',
            'despacho',
            'inventario',
            'cuadre',
            'analitica',
            'cashier',
            'kitchen'
        )
    );

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_is_active_idx on public.profiles (is_active);

alter table public.profiles
    add column if not exists app_permissions jsonb not null default '["pedidos"]'::jsonb;

update public.profiles
set app_permissions = case
    when role = 'admin' then '["pedidos","despacho","crm","inventario","cuadre","analitica","admin"]'::jsonb
    when role = 'pedidos' then '["pedidos","crm"]'::jsonb
    when role = 'despacho' then '["despacho","pedidos"]'::jsonb
    when role = 'inventario' then '["inventario"]'::jsonb
    when role = 'cuadre' then '["cuadre","analitica"]'::jsonb
    when role = 'analitica' then '["analitica","inventario","cuadre"]'::jsonb
    else app_permissions
end
where app_permissions = '["pedidos"]'::jsonb or app_permissions is null;
