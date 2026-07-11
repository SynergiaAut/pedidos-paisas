import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getFlexCrm, DbSource, CrmProductTagged } from '@/lib/flex-crm';
import { mapToInventoryRow } from '@/lib/inventory-mapper';

/**
 * POST /api/milenium/sync-inventario
 * Body opcional: { "db": "01" | "02" | "all" }  (default: "all")
 * Header requerido: x-sync-secret == process.env.SYNC_SECRET
 *
 * Sincroniza el catálogo de productos del ERP (vía API Flex CRM) hacia
 * public.inventory_master. Upsert idempotente por (sku, db_source).
 * Nunca escribe physical_stock. Ver .spec/integracion-api-2bd/plan.md.
 */

const BATCH_SIZE = 500;

// La consulta al ERP puede tardar 30s+ por base (túnel SSH): ampliar timeout del route.
export const maxDuration = 300;

interface DbSyncResult {
    db_source: DbSource;
    fetched: number;
    upserted: number;
    services: number;
    error?: string;
}

export async function POST(req: NextRequest) {
    // --- Auth por secreto compartido (cron / manual) ---
    const secret = process.env.SYNC_SECRET;
    if (!secret) {
        return NextResponse.json(
            { status: 'error', message: 'SYNC_SECRET no configurado en el servidor' },
            { status: 500 }
        );
    }
    if (req.headers.get('x-sync-secret') !== secret) {
        return NextResponse.json({ status: 'error', message: 'No autorizado' }, { status: 401 });
    }

    const started = Date.now();
    const body = await req.json().catch(() => ({}));
    const dbParam: string = body?.db ?? 'all';
    const dbs: DbSource[] = dbParam === '01' || dbParam === '02' ? [dbParam] : ['01', '02'];

    const supabase = await createClient();
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
    return NextResponse.json(
        {
            status: okCount === results.length ? 'success' : okCount > 0 ? 'partial' : 'error',
            duration_ms: Date.now() - started,
            results,
        },
        { status: okCount > 0 ? 200 : 502 }
    );
}
