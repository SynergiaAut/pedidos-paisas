'use server';

import { supabase } from '@/lib/supabase';

export async function activateLicense(licenseKey: string, hardwareId: string) {
    // 1. Validate inputs
    if (!licenseKey || !hardwareId) {
        return { success: false, message: 'Datos incompletos.' };
    }

    try {
        // 2. Call the RPC function we created in the migration
        const { data, error } = await supabase.rpc('activate_license', {
            p_license_key: licenseKey,
            p_hardware_id: hardwareId
        });

        if (error) {
            console.error('License Activation RPC Error:', error);
            return { success: false, message: 'Error de conexión con el servidor de licencias.' };
        }

        // 3. Parse result (RPC returns json)
        // Adjust based on how Supabase client returns JSON types
        const result = data as { success: boolean; message: string };

        return {
            success: result.success,
            message: result.message
        };

    } catch (err) {
        console.error('Unexpected error:', err);
        return { success: false, message: 'Error inesperado durante la activación.' };
    }
}
