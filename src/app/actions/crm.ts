'use server';

import { createClient } from '@/utils/supabase/server';

/**
 * CRM Server Actions - Fixed async/await pattern
 */

// ============================================================
// CLIENT METRICS & DETAILS
// ============================================================

export async function getClientMetrics(clientId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

    if (error) {
        console.error('Error fetching client metrics:', error);
        throw error;
    }

    return data;
}

export async function getAllClients(page = 1, limit = 50, filters?: {
    status?: string;
    rfm_segment?: string;
    search?: string;
}) {
    const supabase = await createClient();
    const offset = (page - 1) * limit;

    let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .order('lifetime_value', { ascending: false });

    if (filters?.status) {
        query = query.eq('status', filters.status);
    }

    if (filters?.rfm_segment) {
        query = query.eq('rfm_segment', filters.rfm_segment);
    }

    if (filters?.search) {
        query = query.or(
            `full_name.ilike.%${filters.search}%,` +
            `phone.ilike.%${filters.search}%,` +
            `email.ilike.%${filters.search}%`
        );
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching clients:', error);
        throw error;
    }

    return { clients: data || [], total: count || 0 };
}

export async function getClientOrderHistory(
    clientId: string,
    page = 1,
    limit = 10
) {
    const supabase = await createClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Error fetching client order history:', error);
        throw error;
    }

    return { orders: data || [], total: count || 0 };
}

export async function getTopClients(
    limit = 10,
    sortBy: 'lifetime_value' | 'total_orders' | 'average_order_value' = 'lifetime_value'
) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, phone, email, total_orders, lifetime_value, average_order_value, rfm_segment, last_order_date')
        .eq('status', 'ACTIVE')
        .order(sortBy, { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching top clients:', error);
        throw error;
    }

    return data || [];
}

export async function searchClients(query: string, limit = 10) {
    const supabase = await createClient();

    if (!query || query.trim().length < 2) {
        return [];
    }

    const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, phone, email, address, total_orders, lifetime_value')
        .or(
            `full_name.ilike.%${query}%,` +
            `phone.ilike.%${query}%,` +
            `email.ilike.%${query}%`
        )
        .eq('status', 'ACTIVE')
        .order('total_orders', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error searching clients:', error);
        return [];
    }

    return data || [];
}

export async function getClientInteractions(clientId: string, limit = 20) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('client_interactions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.warn('client_interactions table might not exist or error:', error);
        return [];
    }

    return data || [];
}

export async function getClientNotes(clientId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('client_notes table might not exist or error:', error);
        return [];
    }

    return data || [];
}

export async function addClientNote(clientId: string, note: string, noteType?: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('client_notes')
        .insert({
            client_id: clientId,
            note: note,
            note_type: noteType || 'GENERAL',
        })
        .select()
        .single();

    if (error) {
        console.error('Error adding client note:', error);
        throw error;
    }

    return data;
}

export async function getClientTags(clientId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('client_tags')
        .select('*')
        .eq('client_id', clientId);

    if (error) {
        console.warn('client_tags table might not exist or error:', error);
        return [];
    }

    return data || [];
}

export async function getRFMSegmentationStats() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .select('rfm_segment')
        .not('rfm_segment', 'is', null);

    if (error) {
        console.error('Error fetching RFM stats:', error);
        return {};
    }

    const segments = data.reduce((acc: Record<string, number>, client) => {
        const segment = client.rfm_segment || 'Unknown';
        acc[segment] = (acc[segment] || 0) + 1;
        return acc;
    }, {});

    return segments;
}

export async function recalculateAllRFMScores() {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('update_all_rfm_scores');

    if (error) {
        console.error('Error recalculating RFM scores:', error);
        throw error;
    }

    return { success: true, message: 'RFM scores recalculated successfully' };
}

// ============================================================
// NEW: CRM DASHBOARD METRICS
// ============================================================

export async function getCRMMetrics() {
    const supabase = await createClient();

    // Get basic client counts
    const [allClientsResult, activeClientsResult, newClientsResult] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true })
            .gte('last_order_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('clients').select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    ]);

    // Get aggregate values
    const { data: aggregateData } = await supabase
        .from('clients')
        .select('lifetime_value, average_order_value');

    const totalClients = allClientsResult.count || 0;
    const activeClients = activeClientsResult.count || 0;
    const newClientsThisMonth = newClientsResult.count || 0;

    const avgLifetimeValue = aggregateData && aggregateData.length > 0
        ? aggregateData.reduce((sum, c) => sum + (Number(c.lifetime_value) || 0), 0) / aggregateData.length
        : 0;

    const avgOrderValue = aggregateData && aggregateData.length > 0
        ? aggregateData.reduce((sum, c) => sum + (Number(c.average_order_value) || 0), 0) / aggregateData.length
        : 0;

    // Calculate retention (clients who ordered again within 30 days of their first order)
    // Note: This requires a database function, defaulting to 0 if not available
    let retentionRate = 0;
    try {
        const { data: retentionData } = await supabase
            .rpc('calculate_client_retention')
            .single();
        retentionRate = (retentionData as any)?.retention_rate || 0;
    } catch (error) {
        console.warn('calculate_client_retention RPC not available:', error);
    }

    return {
        total_clients: totalClients,
        active_clients: activeClients,
        new_clients_this_month: newClientsThisMonth,
        avg_lifetime_value: avgLifetimeValue,
        avg_order_value: avgOrderValue,
        retention_rate: retentionRate
    };
}

export async function getClientSourceDistribution() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .select('source');

    if (error) {
        console.error('Error fetching client source distribution:', error);
        return [];
    }

    const sourceCounts: Record<string, number> = {};

    (data || []).forEach((client: any) => {
        const source = client.source || 'UNKNOWN';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    return Object.entries(sourceCounts).map(([source, count]) => ({
        source,
        count,
        percentage: data.length > 0 ? (count / data.length) * 100 : 0
    }));
}
