-- Enable RLS (already enabled likely)
alter table "public"."clients" enable row level security;
-- Policy to allow anyone (anon) to INSERT into clients
create policy "Enable insert for all users (Public Registration)" on "public"."clients" for
insert to anon,
    authenticated with check (true);
-- Policy to allow reading own data (optional, but good practice)
-- OR just leave existing policies if they exist.
-- Ideally we only need INSERT for the public form.
-- Verify Phone Uniqueness (Constraint) if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_phone_key'
) THEN
ALTER TABLE "public"."clients"
ADD CONSTRAINT "clients_phone_key" UNIQUE ("phone");
END IF;
END $$;