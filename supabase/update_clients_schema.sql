-- Add new fields for detailed client info
alter table public.clients
add column if not exists document_id text,
    add column if not exists first_name text,
    add column if not exists last_name text;
-- Make existing full_name optional or we can keep filling it for backward compatibility/searches
-- For now, we will auto-generate full_name on insert/update via logical or just keep it sync in app code.
-- Let's rely on app code to populate full_name = first + last for simpler search for now.
create index if not exists clients_document_id_idx on public.clients using btree (document_id);