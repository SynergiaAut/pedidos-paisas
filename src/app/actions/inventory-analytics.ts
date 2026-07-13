'use server';

import { createClient } from '@/utils/supabase/server';

export interface SessionSummary {
    session_id: string;
    name: string;
    mode: 'desktop' | 'mobile_link';
    status: 'OPEN' | 'counting' | 'completed';
    started_at: string;
    completed_at: string | null;
    category_filter: string | null;
    items_counted: number;
    discrepancies: number;
    discrepancy_value: number;
}

export interface DiscrepancyTrendPoint {
    session_id: string;
    name: string;
    completed_at: string | null;
    discrepancies: number;
    discrepancy_value: number;
}

export interface CoverageStats {
    counted: number;
    total: number;
    percentage: number;
}

export interface ProblemProductRanking {
    item_master_id: string;
    sku: string;
    description: string;
    sesiones_con_descuadre: number;
    magnitud_acumulada: number;
}

/**
 * Obtiene el resumen consolidado de todas las sesiones de conteo de inventario.
 * Requiere rol de administrador autenticado.
 */
export async function getSessionsSummary(): Promise<SessionSummary[] | { error: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const { data, error } = await supabase
        .from('inventory_session_summary')
        .select('*')
        .order('started_at', { ascending: false });

    if (error) {
        console.error('[InventoryAnalytics] Error al obtener resumen de sesiones:', error);
        return { error: error.message };
    }

    return (data || []) as SessionSummary[];
}

/**
 * Obtiene la tendencia de discrepancias en sesiones finalizadas para graficar.
 * Requiere rol de administrador autenticado.
 */
export async function getDiscrepancyTrend(): Promise<DiscrepancyTrendPoint[] | { error: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const { data, error } = await supabase
        .from('inventory_session_summary')
        .select('session_id, name, completed_at, discrepancies, discrepancy_value')
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: true });

    if (error) {
        console.error('[InventoryAnalytics] Error al obtener tendencia de descuadres:', error);
        return { error: error.message };
    }

    return (data || []) as DiscrepancyTrendPoint[];
}

/**
 * Obtiene estadísticas de cobertura física del catálogo (productos contados alguna vez).
 * Requiere rol de administrador autenticado.
 */
export async function getCoverage(): Promise<CoverageStats | { error: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const [totalRes, countedRes] = await Promise.all([
        supabase
            .from('inventory_master')
            .select('id', { count: 'exact', head: true })
            .eq('is_service', false),
        supabase
            .from('inventory_master')
            .select('id', { count: 'exact', head: true })
            .eq('is_service', false)
            .not('physical_stock', 'is', null)
    ]);

    if (totalRes.error) {
        console.error('[InventoryAnalytics] Error al obtener total de cobertura:', totalRes.error);
        return { error: totalRes.error.message };
    }
    if (countedRes.error) {
        console.error('[InventoryAnalytics] Error al obtener ítems contados de cobertura:', countedRes.error);
        return { error: countedRes.error.message };
    }

    const total = totalRes.count || 0;
    const counted = countedRes.count || 0;
    const percentage = total > 0 ? Math.round((counted / total) * 100) : 0;

    return {
        counted,
        total,
        percentage
    };
}

/**
 * Obtiene el ranking de productos con descuadres recurrentes (≥2 sesiones con discrepancia).
 * Requiere rol de administrador autenticado.
 */
export async function getProblemProductsRanking(limit = 10): Promise<ProblemProductRanking[] | { error: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const { data, error } = await supabase
        .from('inventory_problem_products')
        .select('*')
        .order('sesiones_con_descuadre', { ascending: false })
        .order('magnitud_acumulada', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[InventoryAnalytics] Error al obtener ranking de productos problemáticos:', error);
        return { error: error.message };
    }

    return (data || []) as ProblemProductRanking[];
}

const SUSPICIOUS_COST_THRESHOLD = 5_000_000;

export interface SuspiciousCostItem {
    sku: string;
    description: string;
    cost_avg: number;
}

export interface InventoryValuation {
    totalInventoryValue: number;
    countedInventoryValue: number;
    totalDiscrepancyValue: number;
    lossPercentage: number;
    suspiciousCostItems: SuspiciousCostItem[];
    zeroCostCount: number;
    zeroCostPercentage: number;
    dbSourcesIncluded: string[];
}

/**
 * Obtiene las métricas de valorización general y pérdidas de inventario,
 * blindado contra outliers de costo, con disclosure de orígenes e ítems sin costo.
 * Requiere rol de administrador autenticado.
 */
export async function getInventoryValuation(): Promise<InventoryValuation | { error: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    try {
        // Ejecutamos consultas en paralelo para máxima eficiencia
        const [totalsRes, suspiciousRes, zeroRes, dbRes, discrepancyRes] = await Promise.all([
            // 1. Totales de catálogo y contado excluyendo outliers
            supabase
                .from('inventory_master')
                .select('system_stock, cost_avg, physical_stock')
                .eq('is_service', false)
                .gte('cost_avg', 0)
                .lte('cost_avg', SUSPICIOUS_COST_THRESHOLD),
            
            // 2. Ítems con costo sospechoso
            supabase
                .from('inventory_master')
                .select('sku, description, cost_avg')
                .eq('is_service', false)
                .or(`cost_avg.gt.${SUSPICIOUS_COST_THRESHOLD},cost_avg.lt.0`),

            // 3. Conteo de ítems con costo cero
            supabase
                .from('inventory_master')
                .select('id', { count: 'exact', head: true })
                .eq('is_service', false)
                .eq('cost_avg', 0),

            // 4. Distintos db_source de todo el catálogo
            supabase
                .from('inventory_master')
                .select('db_source'),

            // 5. Total de discrepancias de sesiones completadas
            supabase
                .from('inventory_session_summary')
                .select('discrepancy_value')
                .eq('status', 'completed')
        ]);

        if (totalsRes.error) throw new Error(totalsRes.error.message);
        if (suspiciousRes.error) throw new Error(suspiciousRes.error.message);
        if (zeroRes.error) throw new Error(zeroRes.error.message);
        if (dbRes.error) throw new Error(dbRes.error.message);
        if (discrepancyRes.error) throw new Error(discrepancyRes.error.message);

        // A. Calcular total de catálogo y contado
        let totalInventoryValue = 0;
        let countedInventoryValue = 0;

        for (const item of (totalsRes.data || [])) {
            const sysStock = Number(item.system_stock) || 0;
            const costAvg = Number(item.cost_avg) || 0;
            
            totalInventoryValue += sysStock * costAvg;

            if (item.physical_stock !== null && item.physical_stock !== undefined) {
                countedInventoryValue += sysStock * costAvg;
            }
        }

        // B. Formatear sospechosos
        const suspiciousCostItems: SuspiciousCostItem[] = (suspiciousRes.data || []).map(item => ({
            sku: item.sku || '',
            description: item.description || '',
            cost_avg: Number(item.cost_avg) || 0
        }));

        // C. Calcular costo cero y porcentaje
        const totalItemsCount = (totalsRes.data?.length || 0) + (suspiciousRes.data?.length || 0);
        const zeroCostCount = zeroRes.count || 0;
        const zeroCostPercentage = totalItemsCount > 0 ? Math.round((zeroCostCount / totalItemsCount) * 100) : 0;

        // D. Extraer db_source distintos
        const dbSourcesIncluded = Array.from(new Set((dbRes.data || []).map(d => d.db_source).filter(Boolean))) as string[];

        // E. Calcular valor de descuadres
        const totalDiscrepancyValue = (discrepancyRes.data || []).reduce((acc, curr) => acc + (Number(curr.discrepancy_value) || 0), 0);

        // F. Porcentaje de pérdidas
        const lossPercentage = countedInventoryValue > 0 ? Number(((totalDiscrepancyValue / countedInventoryValue) * 100).toFixed(2)) : 0;

        return {
            totalInventoryValue,
            countedInventoryValue,
            totalDiscrepancyValue,
            lossPercentage,
            suspiciousCostItems,
            zeroCostCount,
            zeroCostPercentage,
            dbSourcesIncluded
        };
    } catch (err: any) {
        console.error('[InventoryAnalytics] Error al obtener valorización blindada:', err);
        return { error: err.message || 'Error inesperado del sistema.' };
    }
}

export interface SessionDetailItem {
    sku: string;
    description: string;
    system_stock: number;
    counted_quantity: number;
    expected_stock: number;
    diferencia: number;
    cost_avg: number;
    valor_descuadre: number;
    system_stock_at_close?: number | null;
    reconciliation_note?: string | null;
}

export interface SessionDetail {
    session_id: string;
    name: string;
    category_filter: string | null;
    status: string;
    started_at: string;
    completed_at: string | null;
    items: SessionDetailItem[];
}

/**
 * Obtiene el detalle completo de los conteos y discrepancias para una sesión específica.
 * Requiere rol de administrador autenticado.
 */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail | { error: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    try {
        // 1. Obtener información general de la sesión
        const { data: session, error: sessionErr } = await supabase
            .from('inventory_sessions')
            .select('id, name, status, started_at, completed_at, category_filter')
            .eq('id', sessionId)
            .single();

        if (sessionErr) throw new Error(sessionErr.message);
        if (!session) throw new Error('Sesión no encontrada');

        // 2. Obtener conteos detallados con joins
        const { data: counts, error: countsErr } = await supabase
            .from('inventory_counts')
            .select(`
                counted_quantity,
                expected_stock,
                system_stock_at_close,
                reconciliation_note,
                inventory_master!inner (
                    sku,
                    description,
                    cost_avg,
                    system_stock
                )
            `)
            .eq('session_id', sessionId);

        if (countsErr) throw new Error(countsErr.message);

        const items: SessionDetailItem[] = (counts || []).map((c: any) => {
            const master = c.inventory_master || {};
            const expected = Number(c.expected_stock) || 0;
            const closeStock = c.system_stock_at_close !== null && c.system_stock_at_close !== undefined ? Number(c.system_stock_at_close) : null;
            const targetExpected = closeStock !== null ? closeStock : expected;
            const counted = Number(c.counted_quantity) || 0;
            const diff = counted - targetExpected;
            const cost = Number(master.cost_avg) || 0;
            const valDescuadre = Math.abs(diff) * cost;

            return {
                sku: master.sku || '',
                description: master.description || '',
                system_stock: Number(master.system_stock) || 0,
                expected_stock: expected,
                counted_quantity: counted,
                diferencia: diff,
                cost_avg: cost,
                valor_descuadre: valDescuadre,
                system_stock_at_close: closeStock,
                reconciliation_note: c.reconciliation_note
            };
        });

        return {
            session_id: session.id,
            name: session.name,
            category_filter: session.category_filter,
            status: session.status,
            started_at: session.started_at,
            completed_at: session.completed_at,
            items
        };
    } catch (err: any) {
        console.error('[InventoryAnalytics] Error al obtener detalle de sesión:', err);
        return { error: err.message || 'Error inesperado.' };
    }
}
