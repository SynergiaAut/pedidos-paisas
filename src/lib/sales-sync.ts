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

// Convertir un objeto Date a string DD/MM/YYYY esperado por el ERP
function formatDateToCrm(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
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
    
    return {
        status: okCount === dbs.length ? 'success' : okCount > 0 ? 'partial' : 'error',
        duration_ms: Date.now() - started,
        results
    };
}
