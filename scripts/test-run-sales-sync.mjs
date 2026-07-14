/**
 * Script de prueba para ejecutar runSalesSync de forma controlada y
 * verificar la carga de ventas en Supabase.
 * Uso: node --experimental-strip-types scripts/test-run-sales-sync.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Cargar variables de entorno locales de .env y .env.local
for (const f of ['.env', '.env.local']) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) {
            process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    }
}

// Asegurarse de que NEXT_RUNTIME o variables críticas existan
process.env.NODE_ENV = 'development';

import { runSalesSync } from '../src/lib/sales-sync.ts';

async function test() {
    console.log('=== Iniciando Sync de Ventas de Prueba ===');
    
    // Vamos a sincronizar del 1 de junio al 15 de julio de 2026
    const start = new Date("2026-06-01T00:00:00");
    const end = new Date("2026-07-15T23:59:59");
    
    console.log(`Período de búsqueda: ${start.toISOString()} a ${end.toISOString()}`);
    
    try {
        const summary = await runSalesSync('01', start, end);
        console.log('Resultado del sync:', JSON.stringify(summary, null, 2));
    } catch (err) {
        console.error('Error crítico al correr el sync de prueba:', err);
    }
}

test();
