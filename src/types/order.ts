
export interface DeliveryDriver {
    id: string;
    full_name: string;
    phone?: string;
    vehicle_plate?: string;
    is_active: boolean;
}

export interface Order {
    id: string; // UUID from Supabase
    public_id: string; // The readable ID e.g. PED-001
    status: 'TOMADO' | 'DESPACHO' | 'EN_CAMINO' | 'ENTREGADO' | 'PAGADO' | 'CANCELADO';
    client_name: string;
    client_id?: string; // NEW: Foreign key to clients table for CRM tracking
    total_value: number;
    observations?: string;
    created_at: string;
    delivery_type?: 'DOMICILIO' | 'TIENDA';
    invoices_data?: any[]; // flexible json
    products?: any[]; // JSONB array of products
    driver_id?: string;
    delivery_drivers?: DeliveryDriver; // For joined queries (singular name because of foreign key relationship usually returns single object)
    clients?: Client; // NEW: For joined queries with client data
}

export interface Client {
    id: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    document_id?: string;
    phone?: string;
    email?: string;
    address?: string;
    total_orders: number;
    last_order_date?: string;
}
