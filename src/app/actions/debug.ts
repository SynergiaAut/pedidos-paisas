'use server';

import { createClient } from "@/utils/supabase/server";

export async function getDebugInfo() {
    const results: any = { steps: [] };

    try {
        const supabase = await createClient();
        results.steps.push({ name: 'Init Supabase', status: 'Success' });

        // 1. Get the last created client
        const { data: lastClient, error } = await supabase
            .from('clients')
            .select('id, full_name, source, created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            results.steps.push({ name: 'Get Last Client', status: 'Failed', error: error.message });
        } else {
            results.lastClient = lastClient;
            results.steps.push({ name: 'Get Last Client', status: 'Success' });
        }

        // Note: Cannot check triggers via REST API.

        // 3. TEST UPDATE: Try to force update source to see if permission exists
        if (results.lastClient) {
            const { data: updateData, error: updateError } = await supabase
                .from('clients')
                .update({ source: 'TEST_UPDATE' })
                .eq('id', results.lastClient.id)
                .select()
                .single();

            if (updateError) {
                results.steps.push({ name: 'Test Update', status: 'Failed', error: updateError.message });
            } else {
                results.steps.push({
                    name: 'Test Update',
                    status: 'Success',
                    result: updateData.source
                });
                // Actually leave it to see if it sticks!
            }
        } else {
            results.steps.push({ name: 'Test Update', status: 'Skipped', error: 'No client found' });
        }

        // 4. TEST UPDATE with 'REFERRAL' (Standard CRM value)
        if (results.lastClient) {
            const { data: updateData, error: updateError } = await supabase
                .from('clients')
                .update({ source: 'REFERRAL' })
                .eq('id', results.lastClient.id)
                .select()
                .single();

            if (updateError) {
                results.steps.push({ name: "Test Update 'REFERRAL'", status: 'Failed', error: updateError.message });
            } else {
                results.steps.push({
                    name: "Test Update 'REFERRAL'",
                    status: 'Success',
                    result: updateData.source
                });
            }
        }

        return { ...results, timestamp: new Date().toISOString() };
    } catch (error: any) {
        return {
            fatalError: true,
            message: error.message || 'Unknown error',
            stack: error.stack,
            results
        };
    }
}
