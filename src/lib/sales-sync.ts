import { createAdminClient } from './supabase-admin';
import { getFlexCrm, invoiceLinesToSalesRows, hasCredentials } from './flex-crm';
import type { DbSource } from './flex-crm';

const BATCH_SIZE = 200;

export interface SalesSyncResult {
    db_source: DbSource;
    invoices_fetched: number;
    lines_upserted: number;
    error?: string;
}

export interface SalesSyncSummary {
    status: 'success' | 'partial' | 'error';
    duration_ms: number;
    results: SalesSyncResult[];
}

// Convertir un objeto Date a string YYYY-MM-DD esperado por Flex CRM en hora Colombia.
function formatDateToCrm(date: Date): string {
    const formatter = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    const parts = formatter.formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value || String(date.getDate()).padStart(2, '0');
    const month = parts.find(p => p.type === 'month')?.value || String(date.getMonth() + 1).padStart(2, '0');
    const year = parts.find(p => p.type === 'year')?.value || String(date.getFullYear());
    
    return `${year}-${month}-${day}`;
}

export async function runSalesSync(
    dbParam: string = 'all',
    startDate?: Date,
    endDate?: Date
): Promise<SalesSyncSummary> {
    const started = Date.now();
    const dbs: DbSource[] = dbParam === '01' || dbParam === '02' ? [dbParam] : ['01', '02'];
    
    // Por defecto, sync de las últimas 24 horas si no se especifican fechas
    const end = endDate || new Date();
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const fi = formatDateToCrm(start);
    const ff = formatDateToCrm(end);
    
    const supabase = createAdminClient();
    const results: SalesSyncResult[] = [];
    
    for (const db of dbs) {
        const result: SalesSyncResult = { db_source: db, invoices_fetched: 0, lines_upserted: 0 };
        try {
            // Degradar suavemente si no hay credenciales
            if (!hasCredentials(db)) {
                console.warn(`[SyncVentas:${db}] Omitido: No hay credenciales configuradas para esta base.`);
                continue;
            }
            
            console.log(`[SyncVentas:${db}] Consultando facturas desde ${fi} hasta ${ff}...`);
            const invoices = await getFlexCrm(db).getInvoices(fi, ff);
            result.invoices_fetched = invoices.length;
            
            // Mapear todas las líneas de factura
            const allRows = invoices.flatMap(inv => invoiceLinesToSalesRows(inv));
            
            if (allRows.length > 0) {
                console.log(`[SyncVentas:${db}] Insertando/actualizando ${allRows.length} líneas de venta...`);
                for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
                    const batch = allRows.slice(i, i + BATCH_SIZE);
                    const { error } = await supabase
                        .from('sales_lines')
                        .upsert(batch, { onConflict: 'db_source,tipodoc,numero,sku' });
                        
                    if (error) {
                        throw new Error(`Upsert batch ${i / BATCH_SIZE + 1} falló: ${error.message}`);
                    }
                    result.lines_upserted += batch.length;
                }
            }
            console.log(`[SyncVentas:${db}] Completado con éxito. ${result.lines_upserted} líneas guardadas.`);
        } catch (error: unknown) {
            result.error = error instanceof Error ? error.message : String(error);
            console.error(`[SyncVentas:${db}] Error de sincronización:`, result.error);
        }
        results.push(result);
    }
    
    const activeDbs = dbs.filter(db => hasCredentials(db));
    const okCount = results.filter(r => !r.error && (r.lines_upserted >= 0 || !hasCredentials(r.db_source))).length;
    
    // Refrescar la vista materializada si hubo cambios en los datos de ventas
    const hasNewSales = results.some(r => r.lines_upserted > 0);
    if (hasNewSales) {
        console.log('[SyncVentas] Refrescando vista materializada mv_daily_sales_aggregation...');
        try {
            const { error: refreshError } = await supabase.rpc('refresh_sales_materialized_view');
            if (refreshError) {
                console.error('[SyncVentas] Error al refrescar vista materializada:', refreshError.message);
            } else {
                console.log('[SyncVentas] Vista materializada refrescada exitosamente.');
            }
        } catch (e) {
            console.error('[SyncVentas] Error inesperado al refrescar vista materializada:', e);
        }
    }

    return {
        status: okCount === dbs.length ? 'success' : okCount > 0 ? 'partial' : 'error',
        duration_ms: Date.now() - started,
        results
    };
}

// ==========================================
// SNAPSHOTS INTRADÍA (Fase S2)
// ==========================================

const CORRUPT_SKUS = ['2202007', '701042', '606042'];

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

export async function runSalesSnapshot(): Promise<{ success: boolean; rows_inserted?: number; error?: string }> {
    const supabase = createAdminClient();
    const hoy = getColombiaDateString();
    const capturedAt = new Date().toISOString();

    try {
        console.log(`[SnapshotVentas] Calculando acumulado de ventas de hoy (${hoy}) en hora Colombia...`);
        
        // Consultar todas las ventas de hoy
        const { data: sales, error: queryError } = await supabase
            .from('sales_lines')
            .select('db_source, cantidad, total, total_costo, sku')
            .eq('fecha', hoy);
            
        if (queryError) {
            throw new Error(`Error consultando sales_lines: ${queryError.message}`);
        }

        const salesList = sales || [];
        
        // Estructuras para acumular por BD y ALL
        const totals: Record<string, { unidades: number; venta: number; costo: number; margen: number }> = {
            '01': { unidades: 0, venta: 0, costo: 0, margen: 0 },
            '02': { unidades: 0, venta: 0, costo: 0, margen: 0 },
            'ALL': { unidades: 0, venta: 0, costo: 0, margen: 0 }
        };

        for (const sale of salesList) {
            const db = sale.db_source === '01' || sale.db_source === '02' ? sale.db_source : '01';
            const qty = Number(sale.cantidad) || 0;
            const saleTotal = Number(sale.total) || 0;
            const costTotal = Number(sale.total_costo) || 0;
            const sku = String(sale.sku);

            // Acumulado de la base de datos correspondiente
            totals[db].unidades += qty;
            totals[db].venta += saleTotal;
            
            // Acumulado ALL general
            totals['ALL'].unidades += qty;
            totals['ALL'].venta += saleTotal;

            // Excluir SKUs corruptos del costo y margen
            if (!CORRUPT_SKUS.includes(sku)) {
                totals[db].costo += costTotal;
                totals[db].margen += (saleTotal - costTotal); // margen en valor monetario

                totals['ALL'].costo += costTotal;
                totals['ALL'].margen += (saleTotal - costTotal);
            }
        }

        // Preparar las filas para insertar
        const snapshotRows = Object.entries(totals).map(([db, t]) => ({
            captured_at: capturedAt,
            db_source: db,
            dia: hoy,
            unidades: t.unidades,
            venta: t.venta,
            costo: t.costo,
            margen: t.margen
        }));

        console.log(`[SnapshotVentas] Insertando ${snapshotRows.length} snapshots acumulados...`);
        
        const { error: insertError } = await supabase
            .from('sales_snapshots')
            .insert(snapshotRows);

        if (insertError) {
            throw new Error(`Error insertando sales_snapshots: ${insertError.message}`);
        }

        console.log(`[SnapshotVentas] OK — Snapshots guardados con éxito.`);
        return { success: true, rows_inserted: snapshotRows.length };

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[SnapshotVentas] FALLÓ:', msg);
        return { success: false, error: msg };
    }
}
