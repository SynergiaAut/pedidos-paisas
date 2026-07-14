import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Faltan variables de entorno.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runAudit() {
    console.log('=== INICIANDO AUDITORÍA DE ALINEACIÓN DE INVENTARIO ===\n');

    // 1. Obtener todos los productos no-servicios de inventory_master
    const { data: inventory, error: invError } = await supabase
        .from('inventory_master')
        .select('sku, db_source, description, unit, system_stock, cost_avg')
        .eq('is_service', false);

    if (invError) {
        console.error('Error al traer inventario:', invError.message);
        process.exit(1);
    }

    const items = inventory || [];
    console.log(`Total de ítems cargados en inventory_master: ${items.length}`);

    // Separar por base
    const db1Items = items.filter(i => i.db_source === '01');
    const db2Items = items.filter(i => i.db_source === '02');
    console.log(`- BD1 ('01' - Interna): ${db1Items.length} ítems`);
    console.log(`- BD2 ('02' - Fiscal): ${db2Items.length} ítems`);

    // Indexar por SKU
    const db1Map = new Map(db1Items.map(i => [i.sku, i]));
    const db2Map = new Map(db2Items.map(i => [i.sku, i]));

    // Medir solape
    let overlapCount = 0;
    let diffDescriptionCount = 0;
    let diffUnitCount = 0;
    const diffDetails = [];

    for (const [sku, item1] of db1Map) {
        if (db2Map.has(sku)) {
            overlapCount++;
            const item2 = db2Map.get(sku);
            
            const desc1 = (item1.description || '').trim().toLowerCase();
            const desc2 = (item2.description || '').trim().toLowerCase();
            const isDescDiff = desc1 !== desc2;

            const unit1 = (item1.unit || '').trim().toLowerCase();
            const unit2 = (item2.unit || '').trim().toLowerCase();
            const isUnitDiff = unit1 !== unit2;

            if (isDescDiff || isUnitDiff) {
                if (isDescDiff) diffDescriptionCount++;
                if (isUnitDiff) diffUnitCount++;
                
                diffDetails.push({
                    sku,
                    desc1: item1.description,
                    desc2: item2.description,
                    unit1: item1.unit,
                    unit2: item2.unit,
                    stock1: item1.system_stock,
                    stock2: item2.system_stock,
                    cost1: item1.cost_avg,
                    cost2: item2.cost_avg
                });
            }
        }
    }

    console.log(`\n=== ANÁLISIS DE SOLAPE ===`);
    console.log(`SKUs en común entre BD1 y BD2: ${overlapCount}`);
    console.log(`- Códigos con descripción distinta: ${diffDescriptionCount}`);
    console.log(`- Códigos con unidad de medida distinta: ${diffUnitCount}`);
    console.log(`- Solape alineado perfecto (mismo código, descripción y unidad): ${overlapCount - diffDetails.length}`);

    // Mostrar algunos ejemplos de discrepancias de descripción/unidad
    if (diffDetails.length > 0) {
        console.log(`\nMuestra de discrepancias (Top 5):`);
        diffDetails.slice(0, 5).forEach(d => {
            console.log(`SKU: ${d.sku}`);
            console.log(`  BD1 (01): ${d.desc1} | Unidad: ${d.unit1} | Stock: ${d.stock1} | Costo: ${d.cost1}`);
            console.log(`  BD2 (02): ${d.desc2} | Unidad: ${d.unit2} | Stock: ${d.stock2} | Costo: ${d.cost2}`);
        });
    }

    // 2. Auditoría de completitud de sales_lines
    console.log(`\n=== ANÁLISIS DE COMPLETITUD DE SALES_LINES ===`);
    const { count: salesLinesCount, error: countError } = await supabase
        .from('sales_lines')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error contando sales_lines:', countError.message);
    } else {
        console.log(`Total de filas en sales_lines: ${salesLinesCount}`);
    }

    // Rango de fechas y conteo por base
    const { data: salesSummary, error: sumError } = await supabase
        .from('sales_lines')
        .select('fecha, db_source');

    if (sumError) {
        console.error('Error obteniendo sumatorias de ventas:', sumError.message);
    } else {
        const list = salesSummary || [];
        const dates = list.map(s => s.fecha).sort();
        const minDate = dates[0] || 'N/A';
        const maxDate = dates[dates.length - 1] || 'N/A';
        
        const count01 = list.filter(s => s.db_source === '01').length;
        const count02 = list.filter(s => s.db_source === '02').length;
        
        console.log(`Rango de fechas en sales_lines: ${minDate} hasta ${maxDate}`);
        console.log(`Líneas registradas de BD1 (01): ${count01}`);
        console.log(`Líneas registradas de BD2 (02): ${count02}`);
    }
}

runAudit().catch(err => console.error(err));
