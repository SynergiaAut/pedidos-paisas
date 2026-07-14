export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
        
        const globalCron = global as any;
        
        // 1. Cron de Inventario
        if (!globalCron.inventorySyncCronRegistered && !isBuild) {
            globalCron.inventorySyncCronRegistered = true;
            
            console.log('[Instrumentation] Inicializando cron de inventario...');
            try {
                const cron = await import('node-cron');
                const { runInventorySync } = await import('./lib/inventory-sync');

                // Programar cada 15 minutos: */15 * * * *
                cron.schedule('*/15 * * * *', async () => {
                    const started = new Date().toISOString();
                    console.log(`[Cron:SyncInventario] Iniciando sincronización de inventario automática en ${started}...`);
                    try {
                        const summary = await runInventorySync('all');
                        console.log(`[Cron:SyncInventario] Completado en ${summary.duration_ms}ms con estado: ${summary.status}`, JSON.stringify(summary.results));
                    } catch (err) {
                        console.error('[Cron:SyncInventario] Error crítico en la tarea automática:', err);
                    }
                });
                
                console.log('[Instrumentation] Cron para sync de inventario registrado (cada 15 minutos: */15 * * * *).');
            } catch (err) {
                console.error('[Instrumentation] Error al registrar cron de inventario:', err);
            }
        }

        // 2. Cron de Ventas (Fase A)
        if (!globalCron.salesSyncCronRegistered && !isBuild) {
            globalCron.salesSyncCronRegistered = true;
            
            console.log('[Instrumentation] Inicializando cron de ventas...');
            try {
                const cron = await import('node-cron');
                const { runSalesSync } = await import('./lib/sales-sync');

                // Programar cada hora en el minuto 5 (ej. 14:05, 15:05) para no solapar con el inventario
                cron.schedule('5 * * * *', async () => {
                    const started = new Date().toISOString();
                    console.log(`[Cron:SyncVentas] Iniciando sincronización incremental de ventas en ${started}...`);
                    try {
                        const summary = await runSalesSync('all');
                        console.log(`[Cron:SyncVentas] Completado en ${summary.duration_ms}ms con estado: ${summary.status}`, JSON.stringify(summary.results));
                    } catch (err) {
                        console.error('[Cron:SyncVentas] Error crítico en la tarea automática:', err);
                    }
                });
                
                console.log('[Instrumentation] Cron para sync de ventas registrado (cada hora en el minuto 5: 5 * * * *).');
            } catch (err) {
                console.error('[Instrumentation] Error al registrar cron de ventas:', err);
            }
        }
    }
}
