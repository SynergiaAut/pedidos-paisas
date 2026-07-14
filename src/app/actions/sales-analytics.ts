'use server';

import { createClient } from '@/utils/supabase/server';

// SKUs corruptos que deben excluirse del cálculo de márgenes (outliers del ERP)
const CORRUPT_SKUS = ['2202007', '701042', '606042'];

export interface BehaviorStats {
    totalSales: number;
    avgMarginPct: number;
    negativeMarginCount: number;
    deadStockCount: number;
    trendData: { fecha: string; total: number; margenPct: number }[];
    topSellers: { sku: string; descripcion: string; cantidad: number; total: number; marginPct: number }[];
    bottomSellers: { sku: string; descripcion: string; system_stock: number; classification: string; brand: string }[];
    negativeMargins: { sku: string; descripcion: string; total: number; marginPct: number }[];
    classifications: string[];
}

export interface ProductDetailData {
    sku: string;
    description: string;
    systemStock: number;
    physicalStock: number | null;
    costAvg: number;
    classification: string | null;
    brand: string | null;
    unit: string | null;
    totalSoldQty: number;
    totalRevenue: number;
    avgMarginPct: number;
    salesTrend: { fecha: string; cantidad: number; total: number }[];
    recentSales: { fecha: string; tipodoc: string; numero: string; cantidad: number; precio: number; margenPct: number }[];
    countsHistory: { sessionName: string; countedAt: string; physicalCount: number; mileniumStock: number; delta: number; status: string }[];
}

/**
 * Verifica si el usuario actual tiene el rol de administrador.
 */
async function verifyAdmin(): Promise<boolean> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return false;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    return profile?.role === 'admin';
}

/**
 * Obtiene los agregados y rankings del comportamiento de productos.
 */
export async function getProductsBehaviorData(filters: {
    periodDays: number;
    classification?: string;
}): Promise<BehaviorStats | { error: string }> {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) {
        return { error: 'Acceso denegado. Se requieren permisos de administrador.' };
    }

    const supabase = await createClient();
    const limitDate = new Date(Date.now() - filters.periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const targetClassification = filters.classification || 'ALL';
    const hoyStr = new Date().toISOString().split('T')[0];

    try {
        // 1. Llamar al RPC para diario acumulado
        const { data: dailyData, error: dailyError } = await supabase.rpc('get_daily_sales_behavior', {
            start_date: limitDate,
            end_date: hoyStr,
            classification_filter: targetClassification
        });

        if (dailyError) {
            throw new Error(`get_daily_sales_behavior falló: ${dailyError.message}`);
        }

        // Calcular agregados de ventas del período
        let totalSales = 0;
        let totalRevenueForMargin = 0;
        let totalCostoForMargin = 0;

        const trendData = (dailyData || []).map((row: any) => {
            const v = Number(row.total_venta) || 0;
            const c = Number(row.total_costo) || 0;
            const vm = Number(row.total_venta_margin) || 0;
            const cm = Number(row.total_costo_margin) || 0;

            totalSales += v;
            totalRevenueForMargin += vm;
            totalCostoForMargin += cm;

            return {
                fecha: String(row.fecha),
                total: v,
                margenPct: vm > 0 ? ((vm - cm) / vm) * 100 : 0
            };
        });

        const avgMarginPct = totalRevenueForMargin > 0
            ? ((totalRevenueForMargin - totalCostoForMargin) / totalRevenueForMargin) * 100
            : 0;

        // 2. Rankings por RPC
        const { data: topSellersData, error: topError } = await supabase.rpc('get_top_sellers', {
            start_date: limitDate,
            end_date: hoyStr,
            classification_filter: targetClassification,
            max_limit: 5
        });

        if (topError) {
            throw new Error(`get_top_sellers falló: ${topError.message}`);
        }

        const topSellers = (topSellersData || []).map((row: any) => ({
            sku: row.sku,
            descripcion: row.descripcion,
            cantidad: Number(row.cantidad) || 0,
            total: Number(row.total) || 0,
            marginPct: Number(row.margin_pct) || 0
        }));

        // Márgenes Críticos (< 10%)
        const { data: negMarginsData, error: negError } = await supabase.rpc('get_negative_margins', {
            start_date: limitDate,
            end_date: hoyStr,
            classification_filter: targetClassification,
            max_limit: 5
        });

        if (negError) {
            throw new Error(`get_negative_margins falló: ${negError.message}`);
        }

        const negativeMargins = (negMarginsData || []).map((row: any) => ({
            sku: row.sku,
            descripcion: row.descripcion,
            total: Number(row.total) || 0,
            marginPct: Number(row.margin_pct) || 0
        }));

        // Conteo general de márgenes negativos
        const { data: negCountData, error: negCountError } = await supabase.rpc('get_negative_margin_count', {
            start_date: limitDate,
            end_date: hoyStr,
            classification_filter: targetClassification
        });

        if (negCountError) {
            throw new Error(`get_negative_margin_count falló: ${negCountError.message}`);
        }

        const negativeMarginCount = Number(negCountData) || 0;

        // Dead Stock
        const { data: deadStockData, error: deadStockError } = await supabase.rpc('get_dead_stock', {
            start_date: limitDate,
            end_date: hoyStr,
            classification_filter: targetClassification,
            max_limit: 5
        });

        if (deadStockError) {
            throw new Error(`get_dead_stock falló: ${deadStockError.message}`);
        }

        const bottomSellers = (deadStockData || []).map((row: any) => ({
            sku: row.sku,
            descripcion: row.descripcion,
            system_stock: Number(row.system_stock) || 0,
            classification: row.classification,
            brand: row.brand
        }));

        const { data: deadStockCountData, error: deadStockCountError } = await supabase.rpc('get_dead_stock_count', {
            start_date: limitDate,
            end_date: hoyStr,
            classification_filter: targetClassification
        });

        if (deadStockCountError) {
            throw new Error(`get_dead_stock_count falló: ${deadStockCountError.message}`);
        }

        const deadStockCount = Number(deadStockCountData) || 0;

        // Clasificaciones distintas
        const { data: classifData } = await supabase
            .from('inventory_master')
            .select('classification')
            .eq('is_service', false)
            .not('classification', 'is', null);

        const classifications = Array.from(new Set((classifData || []).map(c => c.classification).filter(Boolean))) as string[];

        return {
            totalSales,
            avgMarginPct,
            negativeMarginCount,
            deadStockCount,
            trendData,
            topSellers,
            bottomSellers,
            negativeMargins,
            classifications
        };

    } catch (e: any) {
        console.error('[BehaviorAnalytics] Falló agregación server-side:', e.message);
        return { error: `Error al procesar estadísticas: ${e.message}` };
    }
}

/**
 * Obtiene la ficha de detalle para un SKU específico.
 */
export async function getProductDetailData(sku: string): Promise<ProductDetailData | { error: string }> {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) {
        return { error: 'Acceso denegado. Se requieren permisos de administrador.' };
    }

    const supabase = await createClient();

    // 1. Datos básicos del producto
    const { data: item, error: itemError } = await supabase
        .from('inventory_master')
        .select('*')
        .eq('sku', sku)
        .single();

    if (itemError || !item) {
        return { error: 'Producto no encontrado en el inventario.' };
    }

    // 2. Ventas del producto en el tiempo
    const { data: sales, error: salesError } = await supabase
        .from('sales_lines')
        .select('*')
        .eq('sku', sku)
        .order('fecha', { ascending: true });

    if (salesError) {
        return { error: `Error al consultar historial de ventas: ${salesError.message}` };
    }

    const salesList = sales || [];

    // Calcular agregaciones del SKU
    let totalSoldQty = 0;
    let totalRevenue = 0;
    let totalCosto = 0;
    const dailySalesMap: Record<string, { qty: number; total: number }> = {};

    for (const sale of salesList) {
        const qty = Number(sale.cantidad) || 0;
        const totalVal = Number(sale.total) || 0;
        const costoVal = Number(sale.total_costo) || 0;

        totalSoldQty += qty;
        totalRevenue += totalVal;
        totalCosto += costoVal;

        const fecha = String(sale.fecha);
        if (!dailySalesMap[fecha]) {
            dailySalesMap[fecha] = { qty: 0, total: 0 };
        }
        dailySalesMap[fecha].qty += qty;
        dailySalesMap[fecha].total += totalVal;
    }

    const avgMarginPct = totalRevenue > 0
        ? ((totalRevenue - totalCosto) / totalRevenue) * 100
        : 0;

    const salesTrend = Object.entries(dailySalesMap).map(([fecha, d]) => ({
        fecha,
        cantidad: d.qty,
        total: d.total
    }));

    // Formatear transacciones recientes
    const recentSales = salesList
        .slice(-10) // últimas 10
        .map(s => ({
            fecha: String(s.fecha),
            tipodoc: s.tipodoc,
            numero: s.numero,
            cantidad: Number(s.cantidad) || 0,
            precio: Number(s.precio) || 0,
            margenPct: Number(s.margen) || 0
        }))
        .reverse();

    // 3. Historial de descuadres del conteo cíclico
    // Unir inventory_counts con inventory_sessions para recuperar nombres
    const { data: counts, error: countsError } = await supabase
        .from('inventory_counts')
        .select(`
            physical_count,
            milenium_stock,
            delta,
            created_at,
            inventory_sessions (
                name,
                status
            )
        `)
        .eq('sku', sku)
        .order('created_at', { ascending: false });

    const countsHistory = (counts || []).map((c: any) => ({
        sessionName: c.inventory_sessions?.name || 'Conteo Cíclico',
        countedAt: c.created_at,
        physicalCount: Number(c.physical_count) || 0,
        mileniumStock: Number(c.milenium_stock) || 0,
        delta: Number(c.delta) || 0,
        status: c.inventory_sessions?.status || 'COMPLETADA'
    }));

    return {
        sku: item.sku,
        description: item.description || 'Sin descripción',
        systemStock: Number(item.system_stock) || 0,
        physicalStock: item.physical_stock !== null ? Number(item.physical_stock) : null,
        costAvg: Number(item.cost_avg) || 0,
        classification: item.classification,
        brand: item.brand,
        unit: item.unit,
        totalSoldQty,
        totalRevenue,
        avgMarginPct,
        salesTrend,
        recentSales,
        countsHistory
    };
}

// ==========================================
// INTRADAY SNAPSHOTS READS (Fase S4)
// ==========================================

export interface IntradayPoint {
    hora: string;
    captured_at: string;
    venta_01: number;
    unidades_01: number;
    delta_venta_01: number;
    delta_unidades_01: number;
    venta_02: number;
    unidades_02: number;
    delta_venta_02: number;
    delta_unidades_02: number;
    venta_all: number;
    unidades_all: number;
    delta_venta_all: number;
    delta_unidades_all: number;
}

export async function getIntradaySnapshots(diaStr?: string): Promise<IntradayPoint[] | { error: string }> {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) {
        return { error: 'Acceso denegado. Se requieren permisos de administrador.' };
    }

    const supabase = await createClient();
    const targetDay = diaStr || getColombiaDateString();

    // Consultar todos los snapshots de ese día en orden cronológico
    const { data: snapshots, error: snapError } = await supabase
        .from('sales_snapshots')
        .select('*')
        .eq('dia', targetDay)
        .order('captured_at', { ascending: true });

    if (snapError) {
        return { error: `Error al consultar snapshots: ${snapError.message}` };
    }

    const list = snapshots || [];
    
    // Agrupar por la marca de tiempo exacta (captured_at)
    const timeGroups: Record<string, any[]> = {};
    for (const snap of list) {
        const time = snap.captured_at;
        if (!timeGroups[time]) {
            timeGroups[time] = [];
        }
        timeGroups[time].push(snap);
    }

    // Ordenar las marcas de tiempo cronológicamente
    const sortedTimes = Object.keys(timeGroups).sort();
    
    const points: IntradayPoint[] = [];
    
    // Variables para guardar el acumulado anterior por base y calcular el delta
    let prev_01 = { venta: 0, unidades: 0 };
    let prev_02 = { venta: 0, unidades: 0 };
    let prev_all = { venta: 0, unidades: 0 };

    for (const time of sortedTimes) {
        const snaps = timeGroups[time];
        
        const snap_01 = snaps.find(s => s.db_source === '01') || { venta: 0, unidades: 0 };
        const snap_02 = snaps.find(s => s.db_source === '02') || { venta: 0, unidades: 0 };
        const snap_all = snaps.find(s => s.db_source === 'ALL') || { venta: 0, unidades: 0 };

        // Convertir captured_at a hora local legible "HH:MM" de Colombia (UTC-5)
        const dateObj = new Date(time);
        const horaStr = dateObj.toLocaleTimeString('es-CO', {
            timeZone: 'America/Bogota',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const v01 = Number(snap_01.venta) || 0;
        const u01 = Number(snap_01.unidades) || 0;
        
        const v02 = Number(snap_02.venta) || 0;
        const u02 = Number(snap_02.unidades) || 0;
        
        const vall = Number(snap_all.venta) || 0;
        const uall = Number(snap_all.unidades) || 0;

        // Calcular deltas
        const delta_v01 = v01 - prev_01.venta;
        const delta_u01 = u01 - prev_01.unidades;
        
        const delta_v02 = v02 - prev_02.venta;
        const delta_u02 = u02 - prev_02.unidades;
        
        const delta_vall = vall - prev_all.venta;
        const delta_uall = uall - prev_all.unidades;

        points.push({
            hora: horaStr,
            captured_at: time,
            venta_01: v01,
            unidades_01: u01,
            delta_venta_01: delta_v01,
            delta_unidades_01: delta_u01,
            venta_02: v02,
            unidades_02: u02,
            delta_venta_02: delta_v02,
            delta_unidades_02: delta_u02,
            venta_all: vall,
            unidades_all: uall,
            delta_venta_all: delta_vall,
            delta_unidades_all: delta_uall
        });

        // Actualizar anteriores
        prev_01 = { venta: v01, unidades: u01 };
        prev_02 = { venta: v02, unidades: u02 };
        prev_all = { venta: vall, unidades: uall };
    }

    return points;
}

// Helper local para fecha Colombia YYYY-MM-DD
function getColombiaDateString(d: Date = new Date()): string {
    const colombiaOffset = -5 * 60; // en minutos
    const localTime = d.getTime();
    const localOffset = d.getTimezoneOffset(); // en minutos
    const utcTime = localTime + (localOffset * 60 * 1000);
    const colombiaTime = new Date(utcTime + (colombiaOffset * 60 * 1000));
    
    const year = colombiaTime.getFullYear();
    const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
    const day = String(colombiaTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


