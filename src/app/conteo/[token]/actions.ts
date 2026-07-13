'use server';

import { createClient } from '@/utils/supabase/server';
import { reconcileSessionCounts } from '@/app/actions/inventory';

export interface MobileSessionInfo {
    valid: boolean;
    reason?: 'not_found' | 'closed' | 'expired';
    name?: string;
}

export interface MobileSessionItem {
    id: string;
    sku: string;
    description: string;
    classification: string;
    system_stock: number;
    unit?: string;
}

/**
 * Obtiene información básica de una sesión de conteo móvil validando el token.
 */
export async function getSessionInfo(token: string): Promise<MobileSessionInfo> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc('get_mobile_session_info', {
            p_token: token,
        });

        if (error) {
            console.error('[Conteo] Error al verificar sesión:', error);
            return { valid: false, reason: 'not_found' };
        }

        return data as MobileSessionInfo;
    } catch (err) {
        console.error('[Conteo] Excepción al verificar sesión:', err);
        return { valid: false, reason: 'not_found' };
    }
}

/**
 * Obtiene los ítems del catálogo de una sesión de conteo móvil.
 */
export async function getSessionItems(token: string): Promise<MobileSessionItem[]> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc('get_mobile_session_items', {
            p_token: token,
        });

        if (error) {
            console.error('[Conteo] Error al obtener ítems:', error);
            return [];
        }

        return (data || []) as MobileSessionItem[];
    } catch (err) {
        console.error('[Conteo] Excepción al obtener ítems:', err);
        return [];
    }
}

/**
 * Envía un conteo físico para un ítem dentro de la sesión de conteo móvil.
 */
export async function submitCount(
    token: string,
    itemId: string,
    value: number,
    counterName: string
): Promise<{ success: boolean; message?: string; counted_items?: number; total_items?: number }> {
    try {
        if (!itemId) {
            return { success: false, message: 'ID del producto no proporcionado.' };
        }

        if (value === undefined || value === null || value < 0) {
            return { success: false, message: 'La cantidad ingresada no es válida.' };
        }

        const supabase = await createClient();
        const { data, error } = await supabase.rpc('submit_mobile_count', {
            p_token: token,
            p_item_id: itemId,
            p_counted_qty: value,
            p_counter_name: counterName || null,
        });

        if (error) {
            console.error('[Conteo] Error al enviar conteo:', error);
            return { success: false, message: error.message };
        }

        return data as { success: boolean; message?: string; counted_items?: number; total_items?: number };
    } catch (err: any) {
        console.error('[Conteo] Excepción al enviar conteo:', err);
        return { success: false, message: err.message || 'Error inesperado del sistema.' };
    }
}

export interface FinishSessionResult {
    success: boolean;
    message?: string;
    items_counted?: number;
    total_items?: number;
    discrepancies?: number;
    duration_minutes?: number;
}

/**
 * Finaliza la sesión si se completaron todos los ítems.
 */
export async function finishSessionIfComplete(token: string): Promise<FinishSessionResult> {
    try {
        const supabase = await createClient();
        
        // 1. Llamar a la RPC para validar y marcar la sesión como completada
        const { data, error } = await supabase.rpc('finish_mobile_count_session', {
            p_token: token,
        });

        if (error) {
            console.error('[Conteo] Error al finalizar sesión:', error);
            return { success: false, message: error.message };
        }

        const res = data as FinishSessionResult;

        // 2. Si la sesión se cerró exitosamente, ejecutar la reconciliación
        if (res && res.success) {
            try {
                // Obtener el ID de la sesión asociada al token
                const { data: session } = await supabase
                    .from('inventory_sessions')
                    .select('id')
                    .eq('link_token', token)
                    .single();

                if (session) {
                    await reconcileSessionCounts(session.id);
                }
            } catch (reconErr) {
                console.error('[Conteo] Error en la reconciliación de la sesión móvil al cierre:', reconErr);
            }
        }

        return res;
    } catch (err: any) {
        console.error('[Conteo] Excepción al finalizar sesión:', err);
        return { success: false, message: err.message || 'Error inesperado del sistema.' };
    }
}
