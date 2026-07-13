import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase ADMIN (service_role) — SOLO para uso server-side en jobs
 * del sistema (ej. sync de inventario). Bypassa RLS.
 *
 * Reglas (constitución Art. 3):
 * - La key vive en SUPABASE_SERVICE_ROLE_KEY (server-only, NUNCA con prefijo NEXT_PUBLIC_).
 * - Prohibido importar este módulo desde componentes cliente ('use client').
 * - Toda ruta que lo use debe tener su propia autorización (ej. x-sync-secret).
 */
export function createAdminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no configurada');
    if (!key) {
        throw new Error(
            'SUPABASE_SERVICE_ROLE_KEY no configurada. Cópiala de Supabase Dashboard → Settings → API (service_role, secreta) a .env.local'
        );
    }

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
