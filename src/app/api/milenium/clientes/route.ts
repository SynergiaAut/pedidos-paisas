import { NextResponse } from 'next/server';
import { getAllCustomers } from '@/lib/flex-crm';

export async function GET() {
    try {
        console.log("[FastOrder] Solicitando clientes a Flex CRM (Millenium)...");
        const customers = await getAllCustomers();
        
        return NextResponse.json({
            status: 'success',
            count: customers.length,
            data: customers
        });
        
    } catch (error: any) {
        console.error("❌ Error al obtener clientes de Flex CRM:", error);
        return NextResponse.json(
            { status: 'error', message: 'Error consultando ERP', details: error.message },
            { status: 500 }
        );
    }
}
