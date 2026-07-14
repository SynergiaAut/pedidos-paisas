import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
    console.log('Iniciando poblamiento de snapshots mock...');
    
    // Obtener fecha de hoy y ayer
    const dates = [
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // ayer
        new Date().toISOString().split('T')[0] // hoy
    ];

    const allRows = [];

    for (const dia of dates) {
        console.log(`Simulando datos intradía para ${dia}...`);
        
        let cumulative_01 = { unidades: 0, venta: 0, costo: 0, margen: 0 };
        let cumulative_02 = { unidades: 0, venta: 0, costo: 0, margen: 0 };

        // Simular horario de 8:00 AM a 6:00 PM cada 30 minutos (21 puntos por día)
        for (let hour = 8; hour <= 18; hour++) {
            for (let min of [0, 30]) {
                if (hour === 18 && min === 30) continue; // Terminar a las 6:00 PM

                // Timestamps ISO
                const capturedAt = new Date(`${dia}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`).toISOString();
                
                // Ventas incrementales aleatorias para simular el comportamiento de compras
                const deltaQty_01 = Math.floor(Math.random() * 20) + (hour >= 11 && hour <= 13 ? 25 : 5); // Pico al almuerzo
                const deltaVenta_01 = deltaQty_01 * (15000 + Math.floor(Math.random() * 5000));
                const deltaCosto_01 = deltaVenta_01 * 0.72; // Margen ~28%
                
                const deltaQty_02 = Math.floor(Math.random() * 12) + (hour >= 11 && hour <= 13 ? 15 : 2);
                const deltaVenta_02 = deltaQty_02 * (25000 + Math.floor(Math.random() * 8000));
                const deltaCosto_02 = deltaVenta_02 * 0.78; // Margen ~22%

                // Acumuladores
                cumulative_01.unidades += deltaQty_01;
                cumulative_01.venta += deltaVenta_01;
                cumulative_01.costo += deltaCosto_01;
                cumulative_01.margen += (deltaVenta_01 - deltaCosto_01);

                cumulative_02.unidades += deltaQty_02;
                cumulative_02.venta += deltaVenta_02;
                cumulative_02.costo += deltaCosto_02;
                cumulative_02.margen += (deltaVenta_02 - deltaCosto_02);

                // Agregar fila BD 01
                allRows.push({
                    captured_at: capturedAt,
                    db_source: '01',
                    dia: dia,
                    unidades: cumulative_01.unidades,
                    venta: cumulative_01.venta,
                    costo: cumulative_01.costo,
                    margen: cumulative_01.margen
                });

                // Agregar fila BD 02
                allRows.push({
                    captured_at: capturedAt,
                    db_source: '02',
                    dia: dia,
                    unidades: cumulative_02.unidades,
                    venta: cumulative_02.venta,
                    costo: cumulative_02.costo,
                    margen: cumulative_02.margen
                });

                // Agregar fila Consolidada (ALL)
                allRows.push({
                    captured_at: capturedAt,
                    db_source: 'ALL',
                    dia: dia,
                    unidades: cumulative_01.unidades + cumulative_02.unidades,
                    venta: cumulative_01.venta + cumulative_02.venta,
                    costo: cumulative_01.costo + cumulative_02.costo,
                    margen: cumulative_01.margen + cumulative_02.margen
                });
            }
        }
    }

    console.log(`Insertando ${allRows.length} registros en sales_snapshots...`);
    
    // Primero limpiar datos existentes de ayer y hoy para evitar duplicidad en las pruebas
    const { error: deleteError } = await supabase
        .from('sales_snapshots')
        .delete()
        .in('dia', dates);

    if (deleteError) {
        console.error('Error limpiando registros anteriores:', deleteError.message);
        process.exit(1);
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
        const batch = allRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('sales_snapshots')
            .insert(batch);

        if (error) {
            console.error('Error insertando lote:', error.message);
            process.exit(1);
        }
        console.log(`Lote ${i/BATCH_SIZE + 1} insertado (${batch.length} filas).`);
    }

    console.log('¡Seeding completado con total éxito!');
}

seed().catch(err => {
    console.error('Error crítico ejecutando seed:', err);
});
