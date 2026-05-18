import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/test-print
 * Simulates a Milenium print event for testing purposes.
 * Inserts a fake invoice into `invoice_events`, triggering the Realtime subscription.
 */
export async function POST() {
    const productsList = [
        { name: "Arroz con leche x 5kg", price: 28000 },
        { name: "Aceite Girasol 3L", price: 24500 },
        { name: "Azucar Blanca 5kg", price: 18000 },
        { name: "Panela x bulto", price: 95000 },
        { name: "Frijoles Bola Negra 500g", price: 5200 },
        { name: "Leche polvo 800g", price: 32000 },
    ];

    const numProducts = Math.floor(Math.random() * 3) + 2;
    const shuffled = [...productsList].sort(() => 0.5 - Math.random());
    const selectedProducts = shuffled.slice(0, numProducts).map(p => ({
        ...p,
        qty: Math.floor(Math.random() * 3) + 1,
    }));

    const totalValue = selectedProducts.reduce((sum, p) => sum + (p.price * p.qty), 0);
    const facturaNum = `MIL-${Date.now().toString().slice(-6)}`;

    const invoiceData = {
        invoice_number_1: facturaNum,
        invoice_value_1: totalValue,
        invoice_number_2: null,
        invoice_value_2: 0,
        products: selectedProducts,
        status: 'PENDING',
    };

    const { data, error } = await supabase
        .from('invoice_events')
        .insert(invoiceData)
        .select()
        .single();

    if (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        message: '¡Evento de impresión simulado exitosamente!',
        event: data,
    });
}
