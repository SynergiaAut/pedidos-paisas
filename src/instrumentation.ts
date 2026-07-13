export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
        
        const globalCron = global as any;
        if (!globalCron.inventorySyncCronRegistered && !isBuild) {
            globalCron.inventorySyncCronRegistered = true;
            
            console.log('[Instrumentation] Inicializando programador de tareas en segundo plano...');
            
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
    }
}
