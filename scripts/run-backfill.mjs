import { runSalesSync } from '../src/lib/sales-sync.ts';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const days = parseInt(process.argv[2] || '30', 10);
    console.log(`=== INICIANDO BACKFILL DE VENTAS HISTÓRICAS DE LOS ÚLTIMOS ${days} DÍAS ===\n`);

    const hoy = new Date();
    
    // Procesar día por día para evitar timeouts de la API Flex CRM y ser amigables con el túnel
    for (let i = days; i >= 0; i--) {
        const start = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(start.getTime());
        end.setHours(23, 59, 59, 999);

        const dateStr = start.toISOString().split('T')[0];
        console.log(`[Backfill] Sincronizando día ${dateStr} (${days - i}/${days})...`);

        try {
            const summary = await runSalesSync('all', start, end);
            console.log(`  Estado: ${summary.status} | Duración: ${summary.duration_ms}ms`);
            summary.results.forEach(r => {
                console.log(`    Base ${r.db_source} -> Facturas: ${r.invoices_fetched} | Líneas: ${r.lines_upserted} ${r.error ? `| Error: ${r.error}` : ''}`);
            });
        } catch (err) {
            console.error(`  [Backfill] Error fatal en el día ${dateStr}:`, err.message);
        }

        // Delay de 800ms entre llamadas para proteger la base de datos de Firebird
        await delay(800);
    }

    console.log('\n=== BACKFILL COMPLETADO CON ÉXITO ===');
}

main().catch(err => {
    console.error('Error en el script de backfill:', err);
});
