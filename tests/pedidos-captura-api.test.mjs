/**
 * Tests para la normalización de facturas de la API Flex CRM.
 * Ejecutar: npm test   (node --experimental-strip-types --test tests/)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeInvoice, repairMojibake } from '../src/lib/flex-crm.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const muestraPath = resolve(__dirname, '../scripts/validacion-pedidos-MUESTRA.json');
const muestras = JSON.parse(readFileSync(muestraPath, 'utf8'));

test('Debe cargar y parsear correctamente la factura de muestra de la base 01', () => {
    const muestraDb01 = muestras.find(m => m.db === '01');
    assert.ok(muestraDb01, 'Debe existir la muestra de la base 01');
    
    const rawInvoice = muestraDb01.muestras.factura.factura;
    assert.ok(rawInvoice, 'Debe existir el objeto de factura cruda');
    
    const normalized = normalizeInvoice(rawInvoice, '01');
    
    // Verificación de cabecera
    assert.equal(normalized.db_source, '01');
    assert.equal(normalized.tipodoc, 'POS');
    assert.equal(normalized.numero, '418856');
    assert.equal(normalized.fecha, '13/06/2026');
    assert.equal(normalized.id_tercero, '1');
    assert.equal(normalized.nombre_tercero, 'REMISION  COMERCIAL'); // trim remueve el espacio del final
    assert.equal(normalized.id_vendedor, 1114835229);
    assert.equal(normalized.nombre_vendedor, 'ARANGO QUENGUAN DIANA JISSEL');
    assert.equal(normalized.direccion, 'SN');
    assert.equal(normalized.telefono, '');
    
    // Verificación de items
    assert.ok(Array.isArray(normalized.items));
    assert.equal(normalized.items.length, 4);
    
    // Item 1: GATORADE
    const item1 = normalized.items[0];
    assert.equal(item1.sku, '2202012');
    assert.equal(item1.descripcion, 'GATORADE  X 12 UND');
    assert.equal(item1.bodega, '01');
    assert.equal(item1.cantidad, 1);
    assert.equal(item1.precio, 31008.40336134454);
    assert.equal(item1.total, 36900);
    assert.equal(item1.costo_kardex, 26470.69);
    assert.equal(item1.margen, 14.63);

    // Item 2: GRANEL Q IDACAT GATO X LB
    const item2 = normalized.items[1];
    assert.equal(item2.sku, '302040');
    assert.equal(item2.descripcion, 'GRANEL Q IDACAT GATO  X LB');
    assert.equal(item2.bodega, '01');
    assert.equal(item2.cantidad, 3);
    assert.equal(item2.total, 13050);

    // Suma total calculada de los items: 36900 + 13050 + 17400 + 10987.5 = 78337.5
    assert.equal(normalized.total, 78337.5);
});

test('repairMojibake debe limpiar caracteres de codificación incorrecta', () => {
    assert.equal(repairMojibake('BOCADILLO VELEÃ\'O'), 'BOCADILLO VELEÑO');
    assert.equal(repairMojibake('Ã¡Ã©Ã­Ã³Ãº'), 'áéíóú');
    assert.equal(repairMojibake('REMISION  COMERCIAL'), 'REMISION  COMERCIAL');
});
