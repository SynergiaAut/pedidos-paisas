-- Run this to fix the permissions! 
-- (I have removed the line that caused the "already exists" error)
-- 1. Ensure RLS is enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- 2. Drop existing policies to be safe
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.orders;
DROP POLICY IF EXISTS "Full Access" ON public.orders;
-- 3. Re-create the policies correctly
CREATE POLICY "Enable read access for all users" ON public.orders FOR
SELECT TO public USING (true);
CREATE POLICY "Enable insert access for all users" ON public.orders FOR
INSERT TO public WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.orders FOR
UPDATE TO public USING (true);
-- Success! You don't need to run anything else.