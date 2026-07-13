/**
 * Tests del mapper de inventario (funciones puras).
 * Ejecutar: npm test   (node --experimental-strip-types --test tests/)
 * Casos basados en payload REAL de la API Flex CRM (2026-07-11).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isService, skuToItemId, mapToInventoryRow, repairMojibake } from '../src/lib/inventory-mapper.ts';

const NOW = new Date('2026-07-11T20:00:00Z');

/** Producto real de BD1: GOMAS GRISSLY con stock en bodega 01. */
const gomas = {
    db_source: '01',
    sku: '0504111',
    descripcion: 'GOMAS GRISSLY GUSANO REPUESTO BOLSA',
    referencia: '12973',
    clasificacion: 'GOMAS',
    marca: 'COLOMBINA',
    unidad: 'Unidad',
    costo_promedio: 5575.72,
    existencia_total: 45,
    stock_por_bodega: [{ CANTIDAD: 45, ID_BODEGA: '01' }],
};

/** Servicio real: DOMICILIO (flete, sin bodega). */
const domicilio = {
    db_source: '01',
    sku: '00100',
    descripcion: 'DOMICILIO',
    referencia: '00100',
    clasificacion: 'FLETE',
    marca: 'SIN MARCA',
    unidad: 'Unidad',
    costo_promedio: 0,
    existencia_total: 0,
    stock_por_bodega: [{ CANTIDAD: 0, ID_BODEGA: null }],
};

test('producto normal con stock no es servicio', () => {
    assert.equal(isService(gomas), false);
});

test('FLETE es servicio aunque tenga fila de stock con bodega null', () => {
    assert.equal(isService(domicilio), true);
});

test('item sin ninguna bodega asignada es servicio', () => {
    assert.equal(isService({ clasificacion: 'GOMAS', stock_por_bodega: [{ CANTIDAD: 0, ID_BODEGA: null }] }), true);
    assert.equal(isService({ clasificacion: 'GOMAS', stock_por_bodega: [] }), true);
});

test('skuToItemId convierte numericos y rechaza no-numericos', () => {
    assert.equal(skuToItemId('0504111'), 504111);
    assert.equal(skuToItemId('00100'), 100);
    assert.equal(skuToItemId('ABC-1'), null);
    assert.equal(skuToItemId(''), null);
});

test('mapToInventoryRow: producto normal mapea todos los campos', () => {
    const row = mapToInventoryRow(gomas, NOW);
    assert.equal(row.sku, '0504111');           // conserva ceros a la izquierda
    assert.equal(row.item_id, 504111);
    assert.equal(row.barcode, '12973');
    assert.equal(row.description, 'GOMAS GRISSLY GUSANO REPUESTO BOLSA');
    assert.equal(row.system_stock, 45);
    assert.equal(row.cost_avg, 5575.72);
    assert.equal(row.brand, 'COLOMBINA');
    assert.equal(row.db_source, '01');
    assert.equal(row.is_service, false);
    assert.equal(row.last_sync_at, NOW.toISOString());
    assert.deepEqual(row.stock_by_warehouse, [{ CANTIDAD: 45, ID_BODEGA: '01' }]);
});

test('mapToInventoryRow: referencia vacia produce barcode null', () => {
    const row = mapToInventoryRow({ ...gomas, referencia: '' }, NOW);
    assert.equal(row.barcode, null);
});

test('mapToInventoryRow: nunca incluye physical_stock (pertenece a conteos)', () => {
    const row = mapToInventoryRow(gomas, NOW);
    assert.equal(Object.hasOwn(row, 'physical_stock'), false);
});

test('mapToInventoryRow: payload malformado no explota', () => {
    const row = mapToInventoryRow(
        { db_source: '02', sku: 'X1', descripcion: null, referencia: null, clasificacion: null,
          marca: null, unidad: null, costo_promedio: null, existencia_total: null, stock_por_bodega: null },
        NOW
    );
    assert.equal(row.description, '');
    assert.equal(row.system_stock, 0);
    assert.equal(row.cost_avg, 0);
    assert.equal(row.is_service, true);
    assert.deepEqual(row.stock_by_warehouse, []);
});

test('repairMojibake: repara caracteres corruptos típicos', () => {
    assert.equal(repairMojibake('ALIÃ\'OS'), 'ALIÑOS');
    assert.equal(repairMojibake('BOCADILLO VELEÃ\'O'), 'BOCADILLO VELEÑO');
    assert.equal(repairMojibake('APERITIVO GUARAQUEÃ\'O CANECA'), 'APERITIVO GUARAQUEÑO CANECA');
    assert.equal(repairMojibake('Ã¡Ã©Ã­Ã³Ãº Â¿Â¡'), 'áéíóú ¿¡');
    assert.equal(repairMojibake('PRODUCTO NORMAL'), 'PRODUCTO NORMAL'); // No daña los correctos
});
