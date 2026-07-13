-- 010: RLS de inventory_master (modelo cerrado, primera tabla alineada con auditoría S2)
-- Lectura: solo usuarios autenticados de la app.
-- Escritura: NADIE vía API pública — solo el sync server-side con service_role (bypassa RLS).

alter table public.inventory_master enable row level security;

-- Limpiar policies previas de esta tabla (idempotente)
drop policy if exists "inventory_master_select_authenticated" on public.inventory_master;

create policy "inventory_master_select_authenticated"
    on public.inventory_master
    for select
    to authenticated
    using (true);

-- Sin policies de insert/update/delete: quedan bloqueadas para anon y authenticated.
-- El sync (POST /api/milenium/sync-inventario) escribe con service_role.
-- Nota: inventory_counts / inventory_sessions se abordan en la tarea S2 completa.
