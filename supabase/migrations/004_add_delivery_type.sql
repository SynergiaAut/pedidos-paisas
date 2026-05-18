ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_type text DEFAULT 'DOMICILIO';
-- Values: 'DOMICILIO', 'TIENDA'