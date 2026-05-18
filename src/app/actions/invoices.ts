'use server';

import { createClient } from '@/utils/supabase/server';

/**
 * Marks one or two invoice events as PROCESSING immediately when the user
 * accepts them, before navigating to nuevo-pedido. Prevents re-triggering
 * the capture modal on return.
 */
export async function markInvoiceEventsProcessing(eventId: string, secondEventId?: string | null) {
    const supabase = await createClient();
    const ids = [eventId, secondEventId].filter(Boolean) as string[];

    const { error } = await supabase
        .from('invoice_events')
        .update({ status: 'PROCESSING' })
        .in('id', ids);

    if (error) {
        console.error('Error marking invoice events as PROCESSING:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function processInvoiceEvent(eventId: string, orderId: string, secondEventId?: string | null) {
    const supabase = await createClient();

    // Mark all related events as PROCESSED
    const ids = [eventId, secondEventId].filter(Boolean) as string[];
    const { error } = await supabase
        .from('invoice_events')
        .update({ status: 'PROCESSED' })
        .in('id', ids);

    if (error) {
        console.error('Error processing invoice event:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function ignoreInvoiceEvent(eventId: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('invoice_events')
        .update({ status: 'IGNORED' })
        .eq('id', eventId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
