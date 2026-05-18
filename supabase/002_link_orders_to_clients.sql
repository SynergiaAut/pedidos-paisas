-- Migration 002: Link Orders to Clients for CRM Integration
-- Este script conecta los pedidos con los clientes para habilitar
-- el tracking automático de métricas y RFM scoring

-- ============================================================
-- PASO 1: Agregar client_id a orders
-- ============================================================
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Índice para performance en joins y queries
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders(client_id);

-- ============================================================
-- PASO 2: Trigger para actualizar métricas de cliente
-- ============================================================
CREATE OR REPLACE FUNCTION update_client_after_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo si el pedido tiene client_id vinculado
    IF NEW.client_id IS NOT NULL THEN
        -- Actualizar métricas del cliente
        UPDATE clients SET
            total_orders = (
                SELECT COUNT(*) 
                FROM orders 
                WHERE client_id = NEW.client_id
            ),
            last_order_date = (
                SELECT MAX(created_at) 
                FROM orders 
                WHERE client_id = NEW.client_id
            ),
            lifetime_value = (
                SELECT COALESCE(SUM(total_value), 0) 
                FROM orders 
                WHERE client_id = NEW.client_id 
                AND status = 'ENTREGADO'
            ),
            average_order_value = (
                SELECT COALESCE(AVG(total_value), 0) 
                FROM orders 
                WHERE client_id = NEW.client_id 
                AND status = 'ENTREGADO'
            ),
            last_interaction_date = NOW()
        WHERE id = NEW.client_id;
        
        -- Recalcular RFM score si la función existe
        IF EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'calculate_rfm_score'
        ) THEN
            PERFORM calculate_rfm_score(NEW.client_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger (primero eliminar si existe)
DROP TRIGGER IF EXISTS trigger_update_client_after_order ON orders;

CREATE TRIGGER trigger_update_client_after_order
AFTER INSERT OR UPDATE OF status, total_value, client_id ON orders
FOR EACH ROW
EXECUTE FUNCTION update_client_after_order();

-- ============================================================
-- PASO 3: Comentarios y documentación
-- ============================================================
COMMENT ON COLUMN orders.client_id IS 'Foreign key to clients table for CRM tracking. NULL allows quick orders without client registration.';
COMMENT ON COLUMN orders.client_name IS 'Fallback name for orders without registered client (client_id IS NULL)';

-- ============================================================
-- PASO 4: Opcional - Migrar datos existentes
-- ============================================================
-- Si tienes clientes con nombres exactos en orders, puedes intentar vincularlos:
-- ADVERTENCIA: Solo ejecutar si estás seguro de los matches

-- UPDATE orders o
-- SET client_id = c.id
-- FROM clients c
-- WHERE o.client_id IS NULL
-- AND LOWER(TRIM(o.client_name)) = LOWER(TRIM(c.full_name))
-- AND o.client_name IS NOT NULL;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Ver si la columna fue creada correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'client_id';

-- Ver si el trigger fue creado
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_client_after_order';
