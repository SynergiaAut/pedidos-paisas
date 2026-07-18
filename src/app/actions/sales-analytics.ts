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
    firstSalesDate: string | null;
    latestSalesDate: string | null;
    daysWithSales: number;
    isSalesDataStale: boolean;
    coverageNote: string;
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
    const limitDate = getColombiaDateString(new Date(Date.now() - filters.periodDays * 24 * 60 * 60 * 1000));
    const targetClassification = filters.classification || 'ALL';
    const hoyStr = getColombiaDateString();

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

        const trendData: { fecha: string; total: number; margenPct: number }[] = (dailyData || []).map((row: any) => {
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

        const salesDays = trendData.filter((row) => row.total > 0).map((row) => row.fecha);
        const firstSalesDate = salesDays[0] || null;
        const latestSalesDate = salesDays[salesDays.length - 1] || null;
        const isSalesDataStale = Boolean(latestSalesDate && latestSalesDate < hoyStr);
        const coverageNote = latestSalesDate
            ? `Ventas sincronizadas hasta ${latestSalesDate}. ${salesDays.length} dias con ventas en el periodo.`
            : 'Sin ventas sincronizadas en el periodo seleccionado.';

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
            classifications,
            firstSalesDate,
            latestSalesDate,
            daysWithSales: salesDays.length,
            isSalesDataStale,
            coverageNote
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

export interface DailySalesSummary {
    fecha: string;
    venta_01: number;
    unidades_01: number;
    venta_02: number;
    unidades_02: number;
    venta_all: number;
    unidades_all: number;
    line_count: number;
}

export async function getDailySalesSummary(diaStr?: string): Promise<DailySalesSummary | { error: string }> {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) {
        return { error: 'Acceso denegado. Se requieren permisos de administrador.' };
    }

    const supabase = await createClient();
    const targetDay = diaStr || getColombiaDateString();

    const pageSize = 1000;
    const rows: { db_source: string; cantidad: number | string | null; total: number | string | null }[] = [];

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from('sales_lines')
            .select('db_source, cantidad, total')
            .eq('fecha', targetDay)
            .range(from, from + pageSize - 1);

        if (error) {
            return { error: `Error al consultar ventas del dia: ${error.message}` };
        }

        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
    }

    const summary: DailySalesSummary = {
        fecha: targetDay,
        venta_01: 0,
        unidades_01: 0,
        venta_02: 0,
        unidades_02: 0,
        venta_all: 0,
        unidades_all: 0,
        line_count: rows.length
    };

    for (const row of rows) {
        const venta = Number(row.total) || 0;
        const unidades = Number(row.cantidad) || 0;
        if (row.db_source === '01') {
            summary.venta_01 += venta;
            summary.unidades_01 += unidades;
        }
        if (row.db_source === '02') {
            summary.venta_02 += venta;
            summary.unidades_02 += unidades;
        }
        summary.venta_all += venta;
        summary.unidades_all += unidades;
    }

    return summary;
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

    const maxSnapshotValue = list.reduce((max, snap) => Math.max(max, Number(snap.venta) || 0), 0);
    if (list.length === 0 || maxSnapshotValue === 0) {
        return [];
    }
    
    // Agrupar por la hora local formateada "HH:MM" de Colombia
    const timeGroups: Record<string, { snaps: any[]; rawTime: string }> = {};
    for (const snap of list) {
        const dateObj = new Date(snap.captured_at);
        const horaStr = dateObj.toLocaleTimeString('es-CO', {
            timeZone: 'America/Bogota',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        if (!timeGroups[horaStr]) {
            timeGroups[horaStr] = { snaps: [], rawTime: snap.captured_at };
        }
        timeGroups[horaStr].snaps.push(snap);
    }

    // 1. Obtener la hora actual de Colombia para saber hasta dónde rellenar si es el día de hoy,
    // o rellenar las 24 horas completas si es un día pasado.
    const nowCol = new Date();
    const colombiaOffset = -5 * 60; // en minutos
    const utcTime = nowCol.getTime() + (nowCol.getTimezoneOffset() * 60 * 1000);
    const colombiaTime = new Date(utcTime + (colombiaOffset * 60 * 1000));
    
    // Determinar la fecha comercial de hoy
    const hoyStr = getColombiaDateString();
    const isToday = targetDay === hoyStr;

    // Si es hoy, limitamos la serie hasta el minuto actual. Si es un día pasado, la pintamos hasta las 23:55.
    let endHour = 23;
    let endMinute = 55;
    if (isToday) {
        endHour = colombiaTime.getHours();
        endMinute = colombiaTime.getMinutes();
    }

    // Generar todos los intervalos de 5 minutos desde las 00:00 hasta el límite determinado
    const intervals: string[] = [];
    for (let h = 0; h <= endHour; h++) {
        const maxM = (h === endHour) ? endMinute : 59;
        for (let m = 0; m <= maxM; m += 5) {
            const hStr = String(h).padStart(2, '0');
            const mStr = String(m).padStart(2, '0');
            intervals.push(`${hStr}:${mStr}`);
        }
    }

    // Asegurar que si el eje está vacío, al menos tenga el punto de las 00:00
    if (intervals.length === 0) {
        intervals.push('00:00');
    }

    const points: IntradayPoint[] = [];
    
    // Variables para guardar el acumulado anterior por base y calcular el delta
    let current_01 = { venta: 0, unidades: 0 };
    let current_02 = { venta: 0, unidades: 0 };
    let current_all = { venta: 0, unidades: 0 };

    let prev_01 = { venta: 0, unidades: 0 };
    let prev_02 = { venta: 0, unidades: 0 };
    let prev_all = { venta: 0, unidades: 0 };

    for (const time of intervals) {
        // ¿Hay snapshots registrados para esta hora exacta (HH:MM) en la base de datos?
        const group = timeGroups[time];
        
        if (group) {
            const snaps = group.snaps;
            
            const snaps_01 = snaps.filter(s => s.db_source === '01');
            if (snaps_01.length > 0) {
                const s = snaps_01[snaps_01.length - 1];
                current_01 = { venta: Number(s.venta) || 0, unidades: Number(s.unidades) || 0 };
            }
            
            const snaps_02 = snaps.filter(s => s.db_source === '02');
            if (snaps_02.length > 0) {
                const s = snaps_02[snaps_02.length - 1];
                current_02 = { venta: Number(s.venta) || 0, unidades: Number(s.unidades) || 0 };
            }
            
            const snaps_all = snaps.filter(s => s.db_source === 'ALL');
            if (snaps_all.length > 0) {
                const s = snaps_all[snaps_all.length - 1];
                current_all = { venta: Number(s.venta) || 0, unidades: Number(s.unidades) || 0 };
            }
        }

        // Calcular deltas (siempre >= 0)
        const delta_v01 = Math.max(0, current_01.venta - prev_01.venta);
        const delta_u01 = Math.max(0, current_01.unidades - prev_01.unidades);
        
        const delta_v02 = Math.max(0, current_02.venta - prev_02.venta);
        const delta_u02 = Math.max(0, current_02.unidades - prev_02.unidades);
        
        const delta_vall = Math.max(0, current_all.venta - prev_all.venta);
        const delta_uall = Math.max(0, current_all.unidades - prev_all.unidades);

        points.push({
            hora: time,
            captured_at: group ? group.rawTime : `${targetDay}T${time}:00Z`,
            venta_01: current_01.venta,
            unidades_01: current_01.unidades,
            delta_venta_01: delta_v01,
            delta_unidades_01: delta_u01,
            venta_02: current_02.venta,
            unidades_02: current_02.unidades,
            delta_venta_02: delta_v02,
            delta_unidades_02: delta_u02,
            venta_all: current_all.venta,
            unidades_all: current_all.unidades,
            delta_venta_all: delta_vall,
            delta_unidades_all: delta_uall
        });

        // Actualizar anteriores
        prev_01 = { ...current_01 };
        prev_02 = { ...current_02 };
        prev_all = { ...current_all };
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

// ==========================================
// INVENTORY QUALITY REPORT ACTIONS (Fase C)
// ==========================================

export interface QualityReportItem {
    sku: string;
    description: string;
    inconsistencyType: 'description_divergence' | 'unit_divergence' | 'cost_outlier' | 'stock_outlier' | 'missing_unit';
    severity: 'high' | 'medium' | 'low';
    details: string;
    db1Value?: string;
    db2Value?: string;
}

export async function getInventoryQualityReport(): Promise<QualityReportItem[] | { error: string }> {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) {
        return { error: 'Acceso denegado. Se requieren permisos de administrador.' };
    }

    const supabase = await createClient();

    try {
        // Traer catálogo completo
        const { data: inventory, error: invError } = await supabase
            .from('inventory_master')
            .select('sku, db_source, description, unit, system_stock, cost_avg, is_service')
            .eq('is_service', false);

        if (invError) {
            throw new Error(`Error al traer inventario: ${invError.message}`);
        }

        const items = inventory || [];
        const report: QualityReportItem[] = [];

        // Agrupar por SKU
        const skuGroups: Record<string, any[]> = {};
        for (const item of items) {
            const sku = item.sku;
            if (!skuGroups[sku]) {
                skuGroups[sku] = [];
            }
            skuGroups[sku].push(item);
        }

        for (const [sku, list] of Object.entries(skuGroups)) {
            const item01 = list.find(i => i.db_source === '01');
            const item02 = list.find(i => i.db_source === '02');
            const primaryItem = item01 || item02 || { description: 'Sin descripción' };

            // 1. Divergencia de descripción
            if (item01 && item02) {
                const desc1 = (item01.description || '').trim().toLowerCase();
                const desc2 = (item02.description || '').trim().toLowerCase();
                if (desc1 !== desc2) {
                    report.push({
                        sku,
                        description: item01.description,
                        inconsistencyType: 'description_divergence',
                        severity: 'medium',
                        details: 'Descripciones divergentes entre bases.',
                        db1Value: item01.description,
                        db2Value: item02.description
                    });
                }
            }

            // 2. Divergencia de unidades de medida
            if (item01 && item02) {
                const unit1 = (item01.unit || '').trim().toLowerCase();
                const unit2 = (item02.unit || '').trim().toLowerCase();
                if (unit1 !== unit2) {
                    report.push({
                        sku,
                        description: primaryItem.description,
                        inconsistencyType: 'unit_divergence',
                        severity: 'medium',
                        details: 'Unidades de medida distintas entre bases.',
                        db1Value: item01.unit || 'Sin unidad',
                        db2Value: item02.unit || 'Sin unidad'
                    });
                }
            }

            // 3. Outliers de stock o costo por base
            for (const item of list) {
                const stock = Number(item.system_stock) || 0;
                const cost = Number(item.cost_avg) || 0;

                // Stocks anormalmente altos (ej. > 100k unds) o negativos
                if (stock < 0 || stock > 100000) {
                    report.push({
                        sku,
                        description: item.description,
                        inconsistencyType: 'stock_outlier',
                        severity: stock < 0 ? 'high' : 'medium',
                        details: `Stock anormal en BD ${item.db_source}: ${stock} unidades.`,
                        db1Value: item.db_source === '01' ? String(stock) : undefined,
                        db2Value: item.db_source === '02' ? String(stock) : undefined
                    });
                }

                // Costo anormalmente alto (ej. > 500k pesos) o corrupto predefinido
                if (cost < 0 || cost > 500000 || CORRUPT_SKUS.includes(sku)) {
                    const isKnownCorrupt = CORRUPT_SKUS.includes(sku);
                    report.push({
                        sku,
                        description: item.description,
                        inconsistencyType: 'cost_outlier',
                        severity: 'high',
                        details: isKnownCorrupt 
                            ? `Costo corrupto conocido (ERP) en BD ${item.db_source}: $${cost}`
                            : `Costo promedio atípico en BD ${item.db_source}: $${cost}`,
                        db1Value: item.db_source === '01' ? `$${cost}` : undefined,
                        db2Value: item.db_source === '02' ? `$${cost}` : undefined
                    });
                }

                // 4. Falta de unidad de medida
                if (!item.unit || item.unit.trim() === '') {
                    report.push({
                        sku,
                        description: item.description,
                        inconsistencyType: 'missing_unit',
                        severity: 'low',
                        details: `Falta unidad de medida en BD ${item.db_source}.`,
                        db1Value: item.db_source === '01' ? 'Vacía' : undefined,
                        db2Value: item.db_source === '02' ? 'Vacía' : undefined
                    });
                }
            }
        }

        return report;

    } catch (e: any) {
        console.error('[QualityAudit] Error al compilar reporte de calidad:', e.message);
        return { error: `Error al compilar auditoría: ${e.message}` };
    }
}
