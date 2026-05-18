'use server';

import { createClient as createSupabaseClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * CRM Mutation Actions - Create, Update, Delete clients
 */

export async function createClient(data: {
    full_name: string;
    phone?: string;
    email?: string;
    address?: string;
    document_type?: string;
    document_id?: string;
    customer_type: 'INDIVIDUAL' | 'COMPANY';
    company_name?: string;
    tax_id?: string;
    preferred_contact_method: 'PHONE' | 'EMAIL' | 'WHATSAPP';
    source: 'DIRECT' | 'AUTO_REGISTRO' | 'REFERRAL' | 'SOCIAL_MEDIA' | 'WEB' | 'PHONE' | 'OTHER';
    credit_limit?: number;
    payment_terms?: string;
}) {
    try {
        const supabase = await createSupabaseClient();

        const { data: newClient, error } = await supabase
            .from('clients')
            .insert({
                full_name: data.full_name,
                phone: data.phone || null,
                email: data.email || null,
                address: data.address || null,
                document_type: data.document_type || null,
                document_id: data.document_id || null,
                customer_type: data.customer_type,
                company_name: data.company_name || null,
                tax_id: data.tax_id || null,
                preferred_contact_method: data.preferred_contact_method,
                source: data.source,
                credit_limit: data.credit_limit || 0,
                payment_terms: data.payment_terms || null,
                status: 'ACTIVE',
                total_orders: 0,
                lifetime_value: 0,
                average_order_value: 0,
                rfm_score: 0,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating client:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/crm');
        return { success: true, data: newClient };
    } catch (error: any) {
        console.error('Unexpected error creating client:', error);
        return { success: false, error: error?.message || 'Error inesperado' };
    }
}

export async function updateClient(clientId: string, data: Partial<{
    full_name: string;
    phone: string;
    email: string;
    address: string;
    document_type: string;
    document_id: string;
    customer_type: 'INDIVIDUAL' | 'COMPANY';
    company_name: string;
    tax_id: string;
    preferred_contact_method: 'PHONE' | 'EMAIL' | 'WHATSAPP';
    source: 'DIRECT' | 'AUTO_REGISTRO' | 'REFERRAL' | 'SOCIAL_MEDIA' | 'WEB' | 'PHONE' | 'OTHER';
    credit_limit: number;
    payment_terms: string;
    status: 'ACTIVE' | 'INACTIVE';
}>) {
    try {
        const supabase = await createSupabaseClient();

        const { data: updatedClient, error } = await supabase
            .from('clients')
            .update(data)
            .eq('id', clientId)
            .select()
            .single();

        if (error) {
            console.error('Error updating client:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/crm');
        revalidatePath(`/crm/${clientId}`);
        return { success: true, data: updatedClient };
    } catch (error: any) {
        console.error('Unexpected error updating client:', error);
        return { success: false, error: error?.message || 'Error inesperado' };
    }
}

export async function deleteClient(clientId: string) {
    try {
        const supabase = await createSupabaseClient();

        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', clientId);

        if (error) {
            console.error('Error deleting client:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/crm');
        return { success: true };
    } catch (error: any) {
        console.error('Unexpected error deleting client:', error);
        return { success: false, error: error?.message || 'Error inesperado' };
    }
}
