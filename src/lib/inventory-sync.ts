/**
 * Núcleo del sync de inventario: ERP (API Flex CRM) → public.inventory_master.
 * Usado por: POST /api/milenium/sync-inventario (cron/manual con SYNC_SECRET)
 * y la server action triggerInventorySync (botón de la UI, requiere sesión).
 *
 * Upsert idempotente por (sku, db_source). Nunca escribe physical_stock.
 */
import { createAdminClient } from './supabase-admin';
import { getFlexCrm, DbSource, CrmProductTagged } from './flex-crm';
import { mapToInventoryRow } from './inventory-mapper';

const BATCH_SIZE = 500;

export interface DbSyncResult {
    db_source: DbSource;
    fetched: number;
    upserted: number;
    services: number;
    error?: string;
}

export interface SyncSummary {
    status: 'success' | 'partial' | 'error';
    duration_ms: number;
    results: DbSyncResult[];
}

export async function runInventorySync(dbParam: string = 'all'): Promise<SyncSummary> {
    const started = Date.now();
    const dbs: DbSource[] = dbParam === '01' || dbParam === '02' ? [dbParam] : ['01', '02'];

    const supabase = createAdminClient();
    const results: DbSyncResult[] = [];

    for (const db of dbs) {
        const result: DbSyncResult = { db_source: db, fetched: 0, upserted: 0, services: 0 };
        try {
            console.log(`[SyncInventario:${db}] Consultando catálogo al ERP...`);
            const products = await getFlexCrm(db).getAllProducts();
            result.fetched = products.length;

            const now = new Date();
            const rows = products.map((p) =>
                mapToInventoryRow({ ...p, db_source: db } as CrmProductTagged, now)
            );
            result.services = rows.filter((r) => r.is_service).length;

            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);
                const { error } = await supabase
                    .from('inventory_master')
                    .upsert(batch, { onConflict: 'sku,db_source' });

                if (error) {
                    throw new Error(`Upsert lote ${i / BATCH_SIZE + 1}: ${error.message}`);
                }
                result.upserted += batch.length;
            }
            console.log(`[SyncInventario:${db}] OK — ${result.upserted} filas (${result.services} servicios)`);
        } catch (error: unknown) {
            result.error = error instanceof Error ? error.message : String(error);
            console.error(`[SyncInventario:${db}] FALLÓ:`, result.error);
        }
        results.push(result);
    }

    const okCount = results.filter((r) => !r.error).length;
    return {
        status: okCount === results.length ? 'success' : okCount > 0 ? 'partial' : 'error',
        duration_ms: Date.now() - started,
        results,
    };
}
