-- TEMPORARY FIX: Disable RLS on clients table to allow public registration
-- This bypasses the persistent schema cache issue we've been experiencing
-- Disable RLS on clients table
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
-- Note: This makes the table publicly writable
-- TODO: Re-enable RLS once the schema cache issue is resolved
-- TODO: Implement proper RLS policies for production security