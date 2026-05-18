-- It seems the table was created earlier without this column.
-- Run this to add it:
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS observations text;
-- Reload the schema cache is usually automatic, but this fixes the structure.