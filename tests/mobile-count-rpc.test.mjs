/**
 * Tests de integración para las funciones RPC del conteo móvil.
 * Ejecutar: npm test   (node --experimental-strip-types --test tests/)
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno de .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('ERROR: Faltan variables de entorno en .env.local');
  process.exit(1);
}

// Cliente con Service Role (bypassa RLS, simula admin)
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

// Cliente anónimo (simula bodeguero en celular sin login)
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

const TEST_TOKEN = 'test-token-integration-uuid-12345';
let testSessionId = null;
let testItemId = null;

before(async () => {
  // Limpieza inicial por si acaso quedó basura
  await adminClient.from('inventory_sessions').delete().eq('link_token', TEST_TOKEN);

  // Obtener un item real para las pruebas que no sea un servicio
  const { data: item } = await adminClient
    .from('inventory_master')
    .select('id')
    .eq('is_service', false)
    .limit(1)
    .single();

  if (!item) {
    throw new Error('No se encontraron ítems válidos en inventory_master para la prueba.');
  }
  testItemId = item.id;
});

after(async () => {
  // Limpieza final de registros de prueba
  if (testSessionId) {
    await adminClient.from('inventory_counts').delete().eq('session_id', testSessionId);
    await adminClient.from('inventory_sessions').delete().eq('id', testSessionId);
  }
});

test('Flujo de RPCs para Conteo Móvil', async (t) => {

  await t.test('1. Crear sesión de conteo móvil en BD como admin', async () => {
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hora
    
    const { data: session, error } = await adminClient
      .from('inventory_sessions')
      .insert({
        name: 'Sesión Test Integración RPC',
        status: 'counting',
        link_token: TEST_TOKEN,
        expires_at: expiresAt,
        mode: 'mobile_link'
      })
      .select()
      .single();

    assert.equal(error, null);
    assert.ok(session.id);
    testSessionId = session.id;
  });

  await t.test('2. get_mobile_session_info() - Retorna válido para token correcto y sesión abierta', async () => {
    const { data, error } = await anonClient.rpc('get_mobile_session_info', {
      p_token: TEST_TOKEN
    });

    assert.equal(error, null);
    assert.equal(data.valid, true);
  });

  await t.test('3. get_mobile_session_info() - Retorna inválido para token inexistente', async () => {
    const { data, error } = await anonClient.rpc('get_mobile_session_info', {
      p_token: 'token-que-no-existe-123'
    });

    assert.equal(error, null);
    assert.equal(data.valid, false);
    assert.equal(data.reason, 'not_found');
  });

  await t.test('4. get_mobile_session_items() - Retorna el catálogo excluyendo servicios', async () => {
    const { data, error } = await anonClient.rpc('get_mobile_session_items', {
      p_token: TEST_TOKEN
    });

    assert.equal(error, null);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    
    // Verificar que el item devuelto contenga la columna unit
    const firstItem = data[0];
    assert.ok(Object.hasOwn(firstItem, 'unit'), 'El catálogo devuelto debe incluir la propiedad unit');

    // Verificar que el item de prueba esté en la lista devuelta
    const hasTestItem = data.some(it => it.id === testItemId);
    assert.equal(hasTestItem, true, 'El ítem de prueba no está en el catálogo retornado');
  });

  await t.test('5. submit_mobile_count() - Permite insertar un conteo físico válido', async () => {
    const { data, error } = await anonClient.rpc('submit_mobile_count', {
      p_token: TEST_TOKEN,
      p_item_id: testItemId,
      p_counted_qty: 15.5,
      p_counter_name: 'Bodeguero Integración'
    });

    assert.equal(error, null);
    assert.equal(data.success, true);

    // Verificar en la BD (vía adminClient) que el conteo se guardó
    const { data: countRow, error: checkErr } = await adminClient
      .from('inventory_counts')
      .select('*')
      .eq('session_id', testSessionId)
      .eq('item_master_id', testItemId)
      .single();

    assert.equal(checkErr, null);
    assert.equal(Number(countRow.counted_quantity), 15.5);
    assert.equal(countRow.counter_name, 'Bodeguero Integración');
    assert.equal(countRow.source, 'mobile');
  });

  await t.test('6. submit_mobile_count() - Rechaza cantidad negativa', async () => {
    const { data, error } = await anonClient.rpc('submit_mobile_count', {
      p_token: TEST_TOKEN,
      p_item_id: testItemId,
      p_counted_qty: -2.5,
      p_counter_name: 'Bodeguero Negativo'
    });

    assert.equal(error, null);
    assert.equal(data.success, false);
    assert.equal(data.message, 'Cantidad inválida.');
  });

  await t.test('7. Cerrar sesión y probar que get_mobile_session_info() falle', async () => {
    // Cerrar como admin
    const { error } = await adminClient
      .from('inventory_sessions')
      .update({ status: 'completed' })
      .eq('id', testSessionId);

    assert.equal(error, null);

    // Consultar como anon
    const { data, error: infoErr } = await anonClient.rpc('get_mobile_session_info', {
      p_token: TEST_TOKEN
    });

    assert.equal(infoErr, null);
    assert.equal(data.valid, false);
    assert.equal(data.reason, 'closed');
  });

  await t.test('8. submit_mobile_count() - Rechaza inserciones en sesión cerrada', async () => {
    const { data, error } = await anonClient.rpc('submit_mobile_count', {
      p_token: TEST_TOKEN,
      p_item_id: testItemId,
      p_counted_qty: 25,
      p_counter_name: 'Bodeguero Tardío'
    });

    assert.equal(error, null);
    assert.equal(data.success, false);
    assert.equal(data.message, 'Este conteo ya fue cerrado o pausado.');
  });

});
