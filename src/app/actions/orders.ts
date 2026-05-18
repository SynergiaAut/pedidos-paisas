'use server';

import { createClient } from '@/utils/supabase/server';

const MAX_INVOICES = 4;

interface InvoiceEntry {
    code: string;
    value: string;
}

interface ProductItem {
    name: string;
    qty: number;
    price: number;
    type?: string;
}

/**
 * Merges new invoice data and products into an existing active order.
 * Caps total invoices at MAX_INVOICES (4).
 * Returns the updated order or an error.
 */
export async function consolidateOrder({
    existingOrderId,
    newInvoices,
    newProducts,
    newObservations,
}: {
    existingOrderId: string;
    newInvoices: InvoiceEntry[];
    newProducts: ProductItem[];
    newObservations?: string;
}) {
    const supabase = await createClient();

    // 1. Fetch current order data
    const { data: existing, error: fetchError } = await supabase
        .from('orders')
        .select('id, invoices_data, products, total_value, observations')
        .eq('id', existingOrderId)
        .single();

    if (fetchError || !existing) {
        return { success: false, error: 'No se encontró el pedido existente.' };
    }

    // 2. Merge invoices (cap at MAX_INVOICES)
    const currentInvoices: InvoiceEntry[] = Array.isArray(existing.invoices_data)
        ? existing.invoices_data
        : [];

    const slots = MAX_INVOICES - currentInvoices.length;
    const invToAdd = newInvoices.filter(inv => inv.code || inv.value).slice(0, slots);
    const mergedInvoices = [...currentInvoices, ...invToAdd];

    // 3. Merge products
    const currentProducts: ProductItem[] = Array.isArray(existing.products)
        ? existing.products
        : [];
    const mergedProducts = [...currentProducts, ...newProducts];

    // 4. Recalculate total from all invoices
    const newTotal = mergedInvoices.reduce((sum, inv) => {
        const v = parseFloat(String(inv.value).replace(/[^0-9.]/g, '') || '0');
        return sum + v;
    }, 0);

    // 5. Merge observations
    const mergedObs = [existing.observations, newObservations]
        .filter(Boolean)
        .join(' | ') || null;

    // 6. Update the order
    const { error: updateError } = await supabase
        .from('orders')
        .update({
            invoices_data: mergedInvoices,
            products: mergedProducts,
            total_value: newTotal,
            observations: mergedObs,
        })
        .eq('id', existingOrderId);

    if (updateError) {
        console.error('Error consolidating order:', updateError);
        return { success: false, error: updateError.message };
    }

    return {
        success: true,
        addedCount: invToAdd.length,
        totalInvoices: mergedInvoices.length,
        capped: invToAdd.length < newInvoices.filter(i => i.code || i.value).length,
    };
}
