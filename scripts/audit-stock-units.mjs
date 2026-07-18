/**
 * Auditoria enfocada en calidad de stock/unidades.
 *
 * Objetivo: separar dato fuente del ERP vs interpretacion del backend.
 * - Lee inventory_master paginado desde Supabase.
 * - Consulta el payload crudo de Flex CRM para terminos sensibles.
 * - Compara stock[].CANTIDAD, DESCRIPCION_UNIDAD y system_stock guardado.
 *
 * Uso:
 *   node scripts/audit-stock-units.mjs
 *   node scripts/audit-stock-units.mjs arroz azucar panela
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TERMS = process.argv.slice(2).map((x) => x.toLowerCase());
if (TERMS.length === 0) TERMS.push('arroz', 'azucar', 'azúcar');

const env = {};
for (const f of ['.env', '.env.local']) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = env.FLEX_CRM_URL || 'https://me.services.ibla.co';
const DBS = {
  '01': {
    label: 'Interna',
    correo: env.FLEX_CRM_EMAIL_01 || env.FLEX_CRM_EMAIL || '',
    clave: env.FLEX_CRM_CLAVE_01 || env.FLEX_CRM_CLAVE || '',
  },
  '02': {
    label: 'Fiscal',
    correo: env.FLEX_CRM_EMAIL_02 || '',
    clave: env.FLEX_CRM_CLAVE_02 || '',
  },
};

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matchesTerms(text) {
  const t = normalize(text);
  return TERMS.some((term) => t.includes(normalize(term)));
}

function formatNumber(n) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 }).format(Number(n) || 0);
}

async function fetchAllInventory() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('inventory_master')
      .select('sku, db_source, description, unit, system_stock, stock_by_warehouse, cost_avg, is_service, needs_review, review_reason')
      .range(from, to)
      .order('db_source', { ascending: true })
      .order('sku', { ascending: true });

    if (error) throw new Error(`Supabase inventory_master: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function login(db, cfg) {
  const r = await fetch(`${BASE_URL}/crm/empresa/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: cfg.correo, clave: cfg.clave }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await r.json();
  if (!data?.token) throw new Error(data?.message || `HTTP ${r.status}`);
  return data.token;
}

async function fetchCrmProducts(db, cfg) {
  if (!cfg.correo || !cfg.clave) return [];
  const token = await login(db, cfg);
  const r = await fetch(`${BASE_URL}/crm/all/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(120000),
  });
  const data = await r.json();
  return (data.products || []).map((x) => x.producto || x);
}

function stockSum(stock) {
  return Array.isArray(stock) ? stock.reduce((sum, s) => sum + (Number(s.CANTIDAD) || 0), 0) : 0;
}

function stockDetail(stock) {
  if (!Array.isArray(stock) || stock.length === 0) return 'sin stock[]';
  return stock.map((s) => `${s.ID_BODEGA ?? 'null'}=${formatNumber(s.CANTIDAD)}`).join('; ');
}

function printRows(title, rows) {
  console.log(`\n=== ${title} (${rows.length}) ===`);
  for (const r of rows) {
    const review = r.needs_review ? ` | REVIEW: ${r.review_reason}` : '';
    console.log(
      `${r.db_source} ${r.sku} | ${r.description} | unidad=${r.unit || 'N/A'} | system_stock=${formatNumber(r.system_stock)}${review}`
    );
  }
}

const inventory = await fetchAllInventory();
const physicalInventory = inventory.filter((r) => !r.is_service);
console.log(`Inventory_master paginado: ${inventory.length} filas (${physicalInventory.length} no-servicio).`);

const byTerm = physicalInventory.filter((r) => matchesTerms(r.description));
printRows(`Coincidencias en Supabase para: ${TERMS.join(', ')}`, byTerm);

const absurd = physicalInventory
  .filter((r) => Math.abs(Number(r.system_stock) || 0) > 100000)
  .sort((a, b) => Math.abs(Number(b.system_stock) || 0) - Math.abs(Number(a.system_stock) || 0))
  .slice(0, 30);
printRows('Top stock abs > 100.000 en Supabase', absurd);

console.log('\n=== Payload crudo Flex CRM para terminos sensibles ===');
for (const [db, cfg] of Object.entries(DBS)) {
  console.log(`\n--- BD${db} ${cfg.label} ---`);
  try {
    const products = await fetchCrmProducts(db, cfg);
    const hits = products.filter((p) => matchesTerms(p.DESCRIPCION_ITEM));
    console.log(`productos API=${products.length}; coincidencias=${hits.length}`);
    for (const p of hits.slice(0, 50)) {
      const saved = physicalInventory.find((r) => r.db_source === db && String(r.sku) === String(p.ID_ITEM));
      const rawSum = stockSum(p.stock);
      const savedStock = saved ? Number(saved.system_stock) || 0 : null;
      const delta = saved ? savedStock - rawSum : null;
      console.log(
        [
          `${db} ${p.ID_ITEM}`,
          p.DESCRIPCION_ITEM,
          `ID_UNIDAD_COMPRA=${p.ID_UNIDAD_COMPRA || 'N/A'}`,
          `DESCRIPCION_UNIDAD=${p.DESCRIPCION_UNIDAD || 'N/A'}`,
          `API_sum_stock=${formatNumber(rawSum)}`,
          `stock[]=${stockDetail(p.stock)}`,
          saved ? `Supabase_system_stock=${formatNumber(savedStock)}` : 'no guardado en Supabase',
          saved ? `delta_backend=${formatNumber(delta)}` : '',
        ].filter(Boolean).join(' | ')
      );
    }
  } catch (e) {
    console.log(`ERROR BD${db}: ${e.message}`);
  }
}
