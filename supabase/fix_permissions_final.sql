-- 1. Grant Usage on Schema
GRANT USAGE ON SCHEMA public TO anon,
    authenticated;
-- 2. Grant ALL Access to the table (Insert, Select, Update)
GRANT ALL ON TABLE "public"."clients" TO anon,
    authenticated;
-- 3. CRITICAL: Grant permission on ID sequences (often the hidden cause)
GRANT USAGE,
    SELECT ON ALL SEQUENCES IN SCHEMA public TO anon,
    authenticated;
-- 4. Ensure RLS is enabled but allows public access via Policy
ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;
-- 5. Re-apply the opening policy just in case
DROP POLICY IF EXISTS "Public Registration" ON "public"."clients";
CREATE POLICY "Public Registration" ON "public"."clients" FOR
INSERT TO anon,
    authenticated WITH CHECK (true);
-- 6. Force Schema Cache Reload
NOTIFY pgrst,
'reload schema';