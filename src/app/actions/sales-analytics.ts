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

    // 1. Consultar todas las líneas de venta en el período
    let query = supabase
        .from('sales_lines')
        .select('*')
        .gte('fecha', limitDate);

    if (filters.classification && filters.classification !== 'ALL') {
        query = query.eq('id_clasificacion', filters.classification);
    }

    const { data: sales, error: salesError } = await query;
    if (salesError) {
        return { error: `Error al consultar ventas: ${salesError.message}` };
    }

    const salesList = sales || [];

    // 2. Consultar el inventario para obtener clasificaciones y dead stock
    const { data: inventory, error: invError } = await supabase
        .from('inventory_master')
        .select('sku, description, system_stock, classification, brand, is_service')
        .eq('is_service', false);

    if (invError) {
        return { error: `Error al consultar inventario: ${invError.message}` };
    }

    const invList = inventory || [];

    // Clasificaciones únicas disponibles
    const classifications = Array.from(new Set(invList.map(i => i.classification).filter(Boolean))) as string[];

    // 3. Procesar KPIs y rankings en memoria
    let totalSalesVal = 0;
    let totalRevenueForMargin = 0;
    let totalCostoForMargin = 0;

    const productSalesMap: Record<string, { sku: string; descripcion: string; cantidad: number; total: number; totalCosto: number }> = {};
    const dailySalesMap: Record<string, { total: number; totalCosto: number }> = {};
    const skusWithSales = new Set<string>();

    for (const sale of salesList) {
        const totalVal = Number(sale.total) || 0;
        const totalCostoVal = Number(sale.total_costo) || 0;
        const sku = String(sale.sku);

        totalSalesVal += totalVal;
        skusWithSales.add(sku);

        // Excluir SKUs corruptos del cálculo agregado del margen
        if (!CORRUPT_SKUS.includes(sku)) {
            totalRevenueForMargin += totalVal;
            totalCostoForMargin += totalCostoVal;
        }

        // Agrupación por producto
        if (!productSalesMap[sku]) {
            productSalesMap[sku] = {
                sku,
                descripcion: sale.descripcion || 'Sin descripción',
                cantidad: 0,
                total: 0,
                totalCosto: 0
            };
        }
        productSalesMap[sku].cantidad += Number(sale.cantidad) || 0;
        productSalesMap[sku].total += totalVal;
        productSalesMap[sku].totalCosto += totalCostoVal;

        // Agrupación por fecha para gráfico de tendencia
        const fecha = String(sale.fecha);
        if (!dailySalesMap[fecha]) {
            dailySalesMap[fecha] = { total: 0, totalCosto: 0 };
        }
        dailySalesMap[fecha].total += totalVal;
        dailySalesMap[fecha].totalCosto += totalCostoVal;
    }

    // Calcular margen agregado general %
    const avgMarginPct = totalRevenueForMargin > 0
        ? ((totalRevenueForMargin - totalCostoForMargin) / totalRevenueForMargin) * 100
        : 0;

    // Convertir rankings
    const productsSales = Object.values(productSalesMap);
    
    // Top más vendidos (por total facturado)
    const topSellers = [...productsSales]
        .map(p => ({
            sku: p.sku,
            descripcion: p.descripcion,
            cantidad: p.cantidad,
            total: p.total,
            marginPct: p.total > 0 ? ((p.total - p.totalCosto) / p.total) * 100 : 0
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    // Margen negativo o crítico (margen % < 10)
    const negativeMargins = [...productsSales]
        .map(p => ({
            sku: p.sku,
            descripcion: p.descripcion,
            total: p.total,
            marginPct: p.total > 0 ? ((p.total - p.totalCosto) / p.total) * 100 : 0
        }))
        .filter(p => p.marginPct < 10 && !CORRUPT_SKUS.includes(p.sku))
        .sort((a, b) => a.marginPct - b.marginPct)
        .slice(0, 5);

    const negativeMarginCount = productsSales.filter(p => {
        const margin = p.total > 0 ? ((p.total - p.totalCosto) / p.total) * 100 : 0;
        return margin < 0 && !CORRUPT_SKUS.includes(p.sku);
    }).length;

    // Dead Stock: Productos con stock en sistema > 0 y 0 ventas en el período
    const deadStockList = invList
        .filter(inv => {
            const hasStock = (Number(inv.system_stock) || 0) > 0;
            const hasNoSales = !skusWithSales.has(inv.sku);
            
            // Si hay filtro por clasificación
            if (filters.classification && filters.classification !== 'ALL') {
                return hasStock && hasNoSales && inv.classification === filters.classification;
            }
            return hasStock && hasNoSales;
        });

    const deadStockCount = deadStockList.length;

    // Bottom sellers (5 items del dead stock)
    const bottomSellers = deadStockList
        .slice(0, 5)
        .map(i => ({
            sku: i.sku,
            descripcion: i.description || 'Sin descripción',
            system_stock: Number(i.system_stock) || 0,
            classification: i.classification || 'General',
            brand: i.brand || 'Genérica'
        }));

    // Formatear datos de tendencia
    const trendData = Object.entries(dailySalesMap)
        .map(([fecha, d]) => ({
            fecha,
            total: d.total,
            margenPct: d.total > 0 ? ((d.total - d.totalCosto) / d.total) * 100 : 0
        }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return {
        totalSales: totalSalesVal,
        avgMarginPct,
        negativeMarginCount,
        deadStockCount,
        trendData,
        topSellers,
        bottomSellers,
        negativeMargins,
        classifications
    };
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
