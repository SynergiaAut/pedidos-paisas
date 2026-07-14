'use server';

import { createClient } from '@/utils/supabase/server';
import { runInventorySync, SyncSummary } from '@/lib/inventory-sync';
import { getFlexCrm } from '@/lib/flex-crm';

/**
 * Server actions del módulo de inventario.
 * Requieren sesión (el usuario ya pasó por el login / middleware).
 */

export interface PendingSessionInfo {
    id: string;
    name: string;
    mode: 'desktop' | 'mobile_link';
    link_token: string | null;
}

export interface InventoryStats {
    totalProducts: number;      // ítems reales (excluye servicios)
    totalServices: number;
    discrepancies: number;      // physical_stock registrado y distinto al del sistema
    pendingSessions: number;    // sesiones de conteo sin completar
    lastSyncAt: string | null;  // ISO
    pendingSession: PendingSessionInfo | null;
    stockUnits: number;                      // suma de system_stock (ítems reales, excluye servicios)
    stockUnitsByDb: Record<string, number>;  // desglose por base: { '01': n, '02': n }
}

export async function getInventoryStats(): Promise<InventoryStats | { error: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const [products, services, sessions, lastSync, counted, pendingSessionData, stockUnitsData] = await Promise.all([
        supabase.from('inventory_master').select('id', { count: 'exact', head: true }).eq('is_service', false),
        supabase.from('inventory_master').select('id', { count: 'exact', head: true }).eq('is_service', true),
        supabase.from('inventory_sessions').select('id', { count: 'exact', head: true }).neq('status', 'completed'),
        supabase
            .from('inventory_master')
            .select('last_sync_at')
            .not('last_sync_at', 'is', null)
            .order('last_sync_at', { ascending: false })
            .limit(1),
        // Descuadres: PostgREST no compara columnas entre sí; traemos solo
        // los ítems con conteo físico registrado (pocos) y comparamos aquí.
        supabase
            .from('inventory_master')
            .select('system_stock, physical_stock')
            .not('physical_stock', 'is', null)
            .limit(5000),
        supabase
            .from('inventory_sessions')
            .select('id, name, mode, link_token')
            .neq('status', 'completed')
            .order('started_at', { ascending: true })
            .limit(1),
        supabase.rpc('get_stock_units')
    ]);

    const stockUnitsByDb: Record<string, number> = {};
    let stockUnits = 0;
    for (const row of (stockUnitsData.data ?? []) as { db_source: string; units: number }[]) {
        const u = Number(row.units) || 0;
        stockUnitsByDb[row.db_source] = u;
        stockUnits += u;
    }

    const discrepancies = (counted.data ?? []).filter(
        (r) => Number(r.physical_stock) !== Number(r.system_stock)
    ).length;

    const pendingSession = pendingSessionData.data?.[0]
        ? {
            id: pendingSessionData.data[0].id,
            name: pendingSessionData.data[0].name,
            mode: pendingSessionData.data[0].mode as 'desktop' | 'mobile_link',
            link_token: pendingSessionData.data[0].link_token
          }
        : null;

    return {
        totalProducts: products.count ?? 0,
        totalServices: services.count ?? 0,
        discrepancies,
        pendingSessions: sessions.count ?? 0,
        lastSyncAt: lastSync.data?.[0]?.last_sync_at ?? null,
        pendingSession,
        stockUnits,
        stockUnitsByDb
    };
}

/**
 * Dispara el sync desde la UI. Autorización: sesión activa
 * (el núcleo escribe con service_role del lado servidor).
 */
export async function triggerInventorySync(db: '01' | '02' | 'all' = 'all'): Promise<SyncSummary | { error: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    console.log(`[Inventory] Sync manual solicitado por ${user.email} (db=${db})`);
    return runInventorySync(db);
}

export interface DesktopCountItem {
    id: string; // id del item_master
    system_stock: number;
    counted_quantity: number;
}

/**
 * Guarda una sesión de conteo cíclico síncrono desde el wizard de escritorio
 * y actualiza de forma síncrona el stock físico y fecha de conteo en la tabla maestra.
 * Requiere rol de administrador autenticado.
 */
export async function saveDesktopInventoryCount({
    sessionName,
    categoryFilter,
    itemsCounts
}: {
    sessionName: string;
    categoryFilter: string;
    itemsCounts: DesktopCountItem[];
}) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const cleanCategoryFilter = categoryFilter === 'all' ? null : categoryFilter;

    // 1. Crear la sesión
    const { data: session, error: sError } = await supabase
        .from('inventory_sessions')
        .insert({
            name: sessionName,
            status: 'completed',
            started_by: user.id,
            created_by: user.id,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            category_filter: cleanCategoryFilter,
            mode: 'desktop'
        })
        .select()
        .single();

    if (sError) {
        console.error('[Inventory] Error al crear sesión en guardado síncrono:', sError);
        return { error: sError.message };
    }

    // 2. Insertar los registros de conteo físico
    const countsToInsert = itemsCounts.map(item => ({
        session_id: session.id,
        item_master_id: item.id,
        expected_stock: item.system_stock,
        counted_quantity: item.counted_quantity,
        source: 'desktop',
        counted_by: user.id
    }));

    const { error: cError } = await supabase.from('inventory_counts').insert(countsToInsert);

    if (cError) {
        console.error('[Inventory] Error al insertar conteos síncronos:', cError);
        return { error: cError.message };
    }

    // 3. Actualizar de forma síncrona el stock físico en la tabla maestra
    try {
        await Promise.all(
            itemsCounts.map(item =>
                supabase
                    .from('inventory_master')
                    .update({
                        physical_stock: item.counted_quantity,
                        last_counted_at: new Date().toISOString()
                    })
                    .eq('id', item.id)
            )
        );
    } catch (err) {
        console.error('[Inventory] Error al actualizar physical_stock maestro:', err);
    }

    // 4. Ejecutar la reconciliación de la sesión al cierre (síncrona para escritorio)
    try {
        await reconcileSessionCounts(session.id);
    } catch (err) {
        console.error('[Inventory] Fallo en la reconciliación al cierre para escritorio:', err);
    }

    return { success: true, sessionId: session.id };
}

/**
 * Reconcilia los conteos de una sesión comparándolos con el stock de Milenium actual.
 * Si hay diferencia, registra system_stock_at_close y la nota correspondiente.
 * Es tolerante a fallos individuales de productos.
 */
export async function reconcileSessionCounts(sessionId: string) {
    const supabase = await createClient();
    
    // Obtener los conteos con SKU y db_source del producto
    const { data: counts, error } = await supabase
        .from('inventory_counts')
        .select(`
            id,
            expected_stock,
            item_master_id,
            inventory_master (
                sku,
                db_source
            )
        `)
        .eq('session_id', sessionId);
        
    if (error || !counts) {
        console.error('[Reconciliation] Error al consultar conteos de la sesión:', error);
        return;
    }
    
    console.log(`[Reconciliation] Iniciando reconciliación para la sesión ${sessionId} (${counts.length} ítems)...`);
    
    for (const count of counts) {
        const productData = count.inventory_master as any;
        if (!productData || !productData.sku) continue;
        
        const sku = productData.sku;
        const dbSource = productData.db_source;
        const dbCode = String(dbSource).padStart(2, '0') === '02' ? '02' : '01';
        
        try {
            const flexClient = getFlexCrm(dbCode);
            const freshProduct = await flexClient.getOneProduct(sku);
            
            if (freshProduct && freshProduct.existencia_total !== null && freshProduct.existencia_total !== undefined) {
                const freshStock = freshProduct.existencia_total;
                if (freshStock !== count.expected_stock) {
                    const note = `Stock del sistema cambió de ${count.expected_stock} a ${freshStock} durante la sesión (posible venta u otro movimiento). Descuadre recalculado.`;
                    
                    const { error: updateErr } = await supabase
                        .from('inventory_counts')
                        .update({
                            system_stock_at_close: freshStock,
                            reconciliation_note: note
                        })
                        .eq('id', count.id);
                        
                    if (updateErr) {
                        console.error(`[Reconciliation] Error al actualizar item ID ${count.id} (SKU: ${sku}):`, updateErr);
                    } else {
                        console.log(`[Reconciliation] Ítem reconciliado (SKU: ${sku}): ${count.expected_stock} -> ${freshStock}`);
                    }
                }
            }
        } catch (err) {
            console.error(`[Reconciliation] Fallo al reconciliar SKU ${sku}:`, err);
            // Tolerancia a fallos parciales: continuar con el resto
        }
    }
}

