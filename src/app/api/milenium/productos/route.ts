import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/flex-crm';

export async function GET() {
    try {
        console.log("[FastOrder] Solicitando productos a Flex CRM (Millenium)...");
        const products = await getAllProducts();
        
        return NextResponse.json({
            status: 'success',
            count: products.length,
            data: products
        });
        
    } catch (error: any) {
        console.error("❌ Error al obtener productos de Flex CRM:", error);
        return NextResponse.json(
            { status: 'error', message: 'Error consultando ERP', details: error.message },
            { status: 500 }
        );
    }
}
