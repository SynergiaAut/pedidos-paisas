/**
 * Script para inyectar datos simulados de ventas en la tabla sales_lines.
 * Esto asegura que podamos desarrollar y validar la UI en la Fase B con datos reales y consistentes.
 * Uso: node --experimental-strip-types scripts/populate-mock-sales.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Cargar variables de entorno
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

import { createAdminClient } from '../src/lib/supabase-admin.ts';

const supabase = createAdminClient();

// SKUs válidos de inventory_master consultados previamente
const TEST_PRODUCTS = [
    { sku: '0504111', description: 'GOMAS GRISSLY GUSANO BOLSA', classification: 'GOMAS', brand: 'COLOMBINA', cost_avg: 5575.72 },
    { sku: '502089', description: 'TUMIX FRUTAL X100', classification: 'CHICLES', brand: 'CONFITECA', cost_avg: 6049.79 },
    { sku: '1001020', description: 'RICAVENA QUAKER 60GR', classification: 'COLADAS', brand: 'QUAKER', cost_avg: 1006.5 },
    { sku: '1002008', description: 'AVENA QUAKER MOLIDA 400GR', classification: 'POLVO', brand: 'QUAKER', cost_avg: 3408.96 },
    { sku: '1002013', description: 'FROOT LOOPS TIRA', classification: 'CRISPI', brand: 'ECONOMICO', cost_avg: 5566.29 }
];

async function populate() {
    console.log('=== Inyectando Datos de Ventas de Prueba en Supabase ===');
    
    const rows = [];
    const now = new Date();
    
    // Generar datos de ventas para los últimos 30 días
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const fechaDate = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
        const fechaStr = fechaDate.toISOString().split('T')[0];
        
        // Cada día tiene entre 2 y 5 facturas
        const numFacturas = Math.floor(Math.random() * 4) + 2;
        
        for (let f = 0; f < numFacturas; f++) {
            const numeroFactura = String(419000 + dayOffset * 10 + f);
            
            // Cada factura tiene entre 1 y 3 ítems
            const numItems = Math.floor(Math.random() * 3) + 1;
            const chosenProducts = [...TEST_PRODUCTS].sort(() => 0.5 - Math.random()).slice(0, numItems);
            
            for (const prod of chosenProducts) {
                const cantidad = Math.floor(Math.random() * 10) + 1;
                
                // Simular margen del 20% al 30% normalmente
                // Pero inyectar un par de ventas de margen negativo en '502089' y '1002013' para pruebas
                let precio = Math.round(prod.cost_avg * (1.20 + Math.random() * 0.15));
                
                if (Math.random() < 0.15 && (prod.sku === '502089' || prod.sku === '1002013')) {
                    // Margen negativo (precio menor que costo)
                    precio = Math.round(prod.cost_avg * 0.90);
                }
                
                const total = cantidad * precio;
                const totalCosto = cantidad * prod.cost_avg;
                const margenPct = parseFloat((((precio - prod.cost_avg) / precio) * 100).toFixed(2));
                
                rows.push({
                    db_source: '01',
                    tipodoc: 'POS',
                    numero: numeroFactura,
                    fecha: fechaStr,
                    sku: prod.sku,
                    descripcion: prod.description,
                    id_clasificacion: prod.classification,
                    id_marca: prod.brand,
                    id_bodega: '01',
                    id_vendedor: 1114835229,
                    cantidad,
                    precio,
                    total,
                    costo_unit: prod.cost_avg,
                    total_costo: totalCosto,
                    margen: margenPct
                });
            }
        }
    }
    
    console.log(`Guardando ${rows.length} registros en sales_lines...`);
    
    const { error } = await supabase
        .from('sales_lines')
        .upsert(rows, { onConflict: 'db_source,tipodoc,numero,sku' });
        
    if (error) {
        console.error('Error al insertar las líneas de venta:', error);
    } else {
        console.log('✅ Inserción completada con éxito. Base de datos de prueba poblada.');
    }
}

populate();
