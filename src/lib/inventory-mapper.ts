/**
 * Mapper puro: producto Flex CRM (normalizado) → fila de inventory_master.
 * Sin I/O ni dependencias: 100% testeable (tests/inventory-mapper.test.mjs).
 *
 * Regla clave: NUNCA escribe physical_stock — esa columna pertenece a los
 * conteos físicos (CyclicCountWizard) y el sync no debe pisarla.
 */

import type { CrmProductTagged, CrmStockBodega, DbSource } from './flex-crm';

/** Fila destino en public.inventory_master (ver migración 009). */
export interface InventoryRow {
    db_source: DbSource;
    item_id: number | null;
    sku: string;
    barcode: string | null;
    description: string;
    system_stock: number;
    cost_avg: number;
    classification: string | null;
    brand: string | null;
    unit: string | null;
    stock_by_warehouse: CrmStockBodega[];
    is_service: boolean;
    last_sync_at: string;
}

/** Clasificaciones que no son inventario físico (fletes, servicios). */
const SERVICE_CLASSIFICATIONS = new Set(['FLETE', 'SERVICIO', 'SERVICIOS']);

/**
 * Un ítem es "servicio" (no inventariable) si su clasificación es de servicio
 * o si no tiene ninguna bodega asignada (stock vacío o todo ID_BODEGA null).
 */
export function isService(p: Pick<CrmProductTagged, 'clasificacion' | 'stock_por_bodega'>): boolean {
    const clasif = (p.clasificacion ?? '').trim().toUpperCase();
    if (SERVICE_CLASSIFICATIONS.has(clasif)) return true;

    const stock = p.stock_por_bodega ?? [];
    return stock.length === 0 || stock.every((s) => s.ID_BODEGA === null || s.ID_BODEGA === undefined);
}

/** Convierte el sku a item_id numérico (compat con la UI); null si no es numérico. */
export function skuToItemId(sku: string): number | null {
    if (!/^\d+$/.test(sku ?? '')) return null;
    const n = Number.parseInt(sku, 10);
    return Number.isSafeInteger(n) ? n : null;
}

export function repairMojibake(str: string | null | undefined): string {
    if (!str) return '';
    
    // Verificamos si tiene el patrón general de mojibake (contiene Ã o Â)
    if (!str.includes('Ã') && !str.includes('Â')) {
        return str;
    }

    let result = str;
    
    // Mapeo de reemplazos típicos de mojibake de UTF-8 interpretado como Windows-1252 / ISO-8859-1
    const replacements: [RegExp, string][] = [
        // Ñ / ñ
        [/Ã'/g, 'Ñ'],
        [/Ã\u0091/g, 'Ñ'],
        [/Ã‘/g, 'Ñ'],
        [/Ã±/g, 'ñ'],
        
        // Vocales minúsculas con tilde
        [/Ã¡/g, 'á'],
        [/Ã©/g, 'é'],
        [/Ã­/g, 'í'],
        [/Ã\u00ad/g, 'í'],
        [/Ã³/g, 'ó'],
        [/Ãº/g, 'ú'],

        // Vocales mayúsculas con tilde
        [/Ã\u0081/g, 'Á'],
        [/Ã\u0089/g, 'É'],
        [/Ã\u008d/g, 'Í'],
        [/Ã\u0093/g, 'Ó'],
        [/Ã\u009a/g, 'Ú'],
        [/Ã/g, 'Á'],
        [/Ã‰/g, 'É'],
        [/Ã/g, 'Í'],
        [/Ã“/g, 'Ó'],
        [/Ãš/g, 'Ú'],

        // Otros
        [/Â¿/g, '¿'],
        [/Â¡/g, '¡'],
        [/Ã¼/g, 'ü'],
        [/Ãœ/g, 'Ü']
    ];

    for (const [pattern, replacement] of replacements) {
        result = result.replace(pattern, replacement);
    }

    return result;
}

export function mapToInventoryRow(p: CrmProductTagged, now: Date = new Date()): InventoryRow {
    const barcode = (p.referencia ?? '').trim();
    return {
        db_source: p.db_source,
        item_id: skuToItemId(p.sku),
        sku: p.sku,
        barcode: barcode.length > 0 ? barcode : null,
        description: repairMojibake((p.descripcion ?? '').trim()),
        system_stock: p.existencia_total ?? 0,
        cost_avg: p.costo_promedio ?? 0,
        classification: p.clasificacion || null,
        brand: p.marca || null,
        unit: p.unidad || null,
        stock_by_warehouse: p.stock_por_bodega ?? [],
        is_service: isService(p),
        last_sync_at: now.toISOString(),
    };
}
