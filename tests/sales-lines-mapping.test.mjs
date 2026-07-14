/**
 * Tests para el mapeo de facturas a sales_lines para el análisis de comportamiento.
 * Ejecutar: npm test   (node --experimental-strip-types --test tests/)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeInvoice, invoiceLinesToSalesRows } from '../src/lib/flex-crm.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const muestraPath = resolve(__dirname, '../scripts/validacion-pedidos-MUESTRA.json');
const muestras = JSON.parse(readFileSync(muestraPath, 'utf8'));

test('Debe mapear la factura de muestra a filas de sales_lines correctamente', () => {
    const muestraDb01 = muestras.find(m => m.db === '01');
    assert.ok(muestraDb01, 'Debe existir la muestra de la base 01');
    
    const rawInvoice = muestraDb01.muestras.factura.factura;
    const normalized = normalizeInvoice(rawInvoice, '01');
    
    const salesRows = invoiceLinesToSalesRows(normalized);
    
    // Debería tener la misma cantidad de filas que items (4 items únicos)
    assert.equal(salesRows.length, 4);
    
    // Validar el primer item (Gatorade)
    const row1 = salesRows.find(r => r.sku === '2202012');
    assert.ok(row1, 'Debe existir la fila para Gatorade');
    assert.equal(row1.db_source, '01');
    assert.equal(row1.tipodoc, 'POS');
    assert.equal(row1.numero, '418856');
    assert.equal(row1.fecha, '2026-06-13'); // DD/MM/YYYY -> YYYY-MM-DD
    assert.equal(row1.sku, '2202012');
    assert.equal(row1.descripcion, 'GATORADE  X 12 UND');
    assert.equal(row1.id_clasificacion, '22D');
    assert.equal(row1.id_marca, '0233');
    assert.equal(row1.id_bodega, '01');
    assert.equal(row1.cantidad, 1);
    assert.equal(row1.precio, 36900); // En nuestro consolidado, el precio unitario es total/cantidad. 36900 / 1 = 36900 (precio bruto)
    assert.equal(row1.total, 36900);
    assert.equal(row1.costo_unit, 26470.69);
    assert.equal(row1.total_costo, 26470.69);
    assert.equal(row1.margen, 28.26); // ((36900 - 26470.69) / 36900) * 100 = 28.2636% -> 28.26
});

test('Debe consolidar items duplicados del mismo SKU en la misma factura', () => {
    // Generar una factura artificial con dos líneas del mismo SKU
    const mockInvoice = {
        db_source: '01',
        tipodoc: 'POS',
        numero: '999999',
        fecha: '13/06/2026',
        id_tercero: '1',
        nombre_tercero: 'TEST',
        id_vendedor: 12345,
        nombre_vendedor: 'VENDEDOR',
        direccion: 'DIR',
        telefono: 'TEL',
        total: 15000,
        items: [], // no usado por invoiceLinesToSalesRows directamente
        raw: {
            items: [
                {
                    ID_ITEM: '101010',
                    DESCRIPCION_ITEM: 'ITEM DUPLICADO',
                    ID_CLASIFICACION: '01A',
                    ID_MARCA_ITEM: 'MARK',
                    ID_BODEGA: '01',
                    CANTIDAD: 2,
                    PRECIO: 4000,
                    TOTAL: 8000,
                    COSTO_KARDEX: 3000,
                    TOTAL_COSTO: 6000,
                    MARGEN: 25.0
                },
                {
                    ID_ITEM: '101010',
                    DESCRIPCION_ITEM: 'ITEM DUPLICADO',
                    ID_CLASIFICACION: '01A',
                    ID_MARCA_ITEM: 'MARK',
                    ID_BODEGA: '01',
                    CANTIDAD: 1,
                    PRECIO: 4000,
                    TOTAL: 4000,
                    COSTO_KARDEX: 3000,
                    TOTAL_COSTO: 3000,
                    MARGEN: 25.0
                }
            ]
        }
    };
    
    const salesRows = invoiceLinesToSalesRows(mockInvoice);
    assert.equal(salesRows.length, 1);
    
    const consolidated = salesRows[0];
    assert.equal(consolidated.sku, '101010');
    assert.equal(consolidated.cantidad, 3); // 2 + 1
    assert.equal(consolidated.total, 12000); // 8000 + 4000
    assert.equal(consolidated.total_costo, 9000); // 6000 + 3000
    assert.equal(consolidated.precio, 4000); // 12000 / 3
    assert.equal(consolidated.costo_unit, 3000); // 9000 / 3
    assert.equal(consolidated.margen, 25.0); // ((12000 - 9000) / 12000) * 100 = 25.0
});
