'use server';

import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export interface MobileSessionProgress {
    counted: number;
    total: number;
}

const DEFAULT_SESSION_WINDOW_HOURS = 72;

/**
 * Crea una sesión de conteo móvil con token público.
 * Requiere rol de administrador autenticado.
 */
export async function createMobileCountSession({
    name,
    categoryFilter,
    hoursValid = DEFAULT_SESSION_WINDOW_HOURS,
}: {
    name: string;
    categoryFilter: string;
    hoursValid?: number;
}) {
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) {
        return { error: 'Falta configurar la variable de entorno APP_BASE_URL en el servidor.' };
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000).toISOString();
    const cleanCategoryFilter = categoryFilter === 'all' ? null : categoryFilter;

    const { data: session, error } = await supabase
        .from('inventory_sessions')
        .insert({
            name,
            status: 'counting',
            started_by: user.id,
            created_by: user.id,
            started_at: new Date().toISOString(),
            link_token: token,
            expires_at: expiresAt,
            category_filter: cleanCategoryFilter,
            mode: 'mobile_link'
        })
        .select()
        .single();

    if (error) {
        console.error('[MobileCount] Error creando sesión móvil:', error);
        return { error: error.message };
    }

    return {
        success: true,
        session,
        token,
        expiresAt,
        url: `${appBaseUrl}/conteo/${token}`
    };
}

/**
 * Cierra una sesión de conteo móvil.
 * Requiere rol de administrador autenticado.
 */
export async function closeMobileCountSession(sessionId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const { error } = await supabase
        .from('inventory_sessions')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

    if (error) {
        console.error('[MobileCount] Error cerrando sesión:', error);
        return { error: error.message };
    }

    return { success: true };
}

/**
 * Pausa una sesión de conteo móvil.
 * Requiere rol de administrador autenticado.
 */
export async function pauseMobileCountSession(sessionId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const { error } = await supabase
        .from('inventory_sessions')
        .update({
            status: 'paused'
        })
        .eq('id', sessionId);

    if (error) {
        console.error('[MobileCount] Error pausando sesión:', error);
        return { error: error.message };
    }

    return { success: true };
}

/**
 * Reanuda una sesión de conteo móvil extendiendo su expiración en 72 horas.
 * Requiere rol de administrador autenticado.
 */
export async function resumeMobileCountSession(sessionId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const expiresAt = new Date(Date.now() + DEFAULT_SESSION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('inventory_sessions')
        .update({
            status: 'counting',
            expires_at: expiresAt
        })
        .eq('id', sessionId);

    if (error) {
        console.error('[MobileCount] Error reanudando sesión:', error);
        return { error: error.message };
    }

    return { success: true };
}

/**
 * Obtiene el progreso de la sesión de conteo móvil en vivo.
 * Requiere rol de administrador autenticado.
 */
export async function getMobileSessionProgress(sessionId: string): Promise<MobileSessionProgress | { error: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    // 1. Obtener la sesión para saber su filtro
    const { data: session, error: sError } = await supabase
        .from('inventory_sessions')
        .select('category_filter')
        .eq('id', sessionId)
        .single();

    if (sError || !session) {
        return { error: sError?.message || 'Sesión no encontrada' };
    }

    // 2. Traer el total de items en inventory_master que no son servicios y que cumplen el filtro
    let query = supabase
        .from('inventory_master')
        .select('id', { count: 'exact', head: true })
        .eq('is_service', false);

    if (session.category_filter) {
        query = query.eq('classification', session.category_filter);
    }

    const { count: total, error: mError } = await query;
    if (mError) {
        return { error: mError.message };
    }

    // 3. Traer los conteos realizados para esta sesión
    const { data: counts, error: cError } = await supabase
        .from('inventory_counts')
        .select('item_master_id')
        .eq('session_id', sessionId);

    if (cError) {
        return { error: cError.message };
    }

    // Contar los productos únicos contados
    const uniqueCounted = new Set(counts?.map((c) => c.item_master_id)).size;

    return {
        counted: uniqueCounted,
        total: total || 0
    };
}
