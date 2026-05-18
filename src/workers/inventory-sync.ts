import { FirebirdService } from '../lib/firebird';
import { supabase } from '../lib/supabase';

/**
 * InventorySyncWorker
 * Sincroniza el catálogo de productos de ambas bases de datos locales
 * hacia la tabla maestra en Supabase.
 */
export class InventorySyncWorker {
    private isSyncing: boolean = false;

    /**
     * Ejecuta una sincronización completa de ambas bases de datos
     */
    public async syncAll() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        console.log('[InventorySync] Iniciando sincronización unificada...');

        try {
            await this.syncDatabase('01');
            await this.syncDatabase('02');
            console.log('[InventorySync] Sincronización completada exitosamente.');
        } catch (error: any) {
            console.error('[InventorySync] Error fatal durante la sincronización:', error.message);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Sincroniza una base de datos específica
     */
    private async syncDatabase(dbKey: '01' | '02') {
        console.log(`[InventorySync] Sincronizando DB ${dbKey}...`);
        
        const productos = await FirebirdService.getProductosActivos(dbKey);
        console.log(`[InventorySync] DB ${dbKey}: ${productos.length} productos detectados.`);

        for (const p of productos) {
            const { error } = await supabase
                .from('inventory_master')
                .upsert({
                    db_source: dbKey,
                    item_id: p.ID_ITEM,
                    sku: p.ID_ITEM.toString(),
                    barcode: p.CODIGO_BARRA,
                    description: p.DESCRIPCION,
                    category: p.CATEGORIA,
                    system_stock: 0, // El stock se actualizará vía polling o consulta dedicada
                    last_sync_at: new Date().toISOString()
                }, {
                    onConflict: 'db_source,item_id'
                });

            if (error) {
                console.error(`[InventorySync] Error haciendo upsert del ítem ${p.ID_ITEM} de DB ${dbKey}:`, error.message);
            }
        }
    }
}

// Ejecución manual si se llama directamente
if (require.main === module) {
    const worker = new InventorySyncWorker();
    worker.syncAll();
}
