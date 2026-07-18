/**
 * Interpreta stocks crudos de Millenium como hipotesis de unidades.
 *
 * No corrige datos. Produce equivalencias para validar con Camilo / inventario:
 * - stock crudo como unidades
 * - si el stock fueran gramos
 * - si el stock fueran libras
 * - paquetes segun presentacion detectada en descripcion (500G, 454G, 1KG, X LB)
 * - arrobas de 25 libras
 *
 * Uso:
 *   node scripts/interpret-stock-units.mjs arroz
 *   node scripts/interpret-stock-units.mjs azucar azúcar
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

const GRAMS_PER_LB = 453.59237;
const LBS_PER_ARROBA = 25;
const GRAMS_PER_ARROBA = GRAMS_PER_LB * LBS_PER_ARROBA;

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

function n(value, digits = 2) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}

function detectPresentationGrams(description) {
  const text = normalize(description).toUpperCase();

  const kg = text.match(/X\s*(\d+(?:[.,]\d+)?)\s*K(?:G|ILO|ILOS)\b/);
  if (kg) return parseNumericToken(kg[1]) * 1000;

  const grams = text.match(/X\s*(\d+(?:[.,]\d+)?)\s*(?:G|GR|GRAMOS?)\b/);
  if (grams) return parseNumericToken(grams[1]);

  if (/\bX\s*LB\b|\bX\s*LIBRA\b/.test(text)) return GRAMS_PER_LB;

  return null;
}

function parseNumericToken(token) {
  const raw = String(token || '').trim();
  if (raw.includes('.') && !raw.includes(',')) {
    const parts = raw.split('.');
    const last = parts[parts.length - 1];
    if (last.length === 3) return Number(parts.join(''));
  }
  return Number(raw.replace(',', '.'));
}

function presentationLabel(grams) {
  if (!grams) return 'no detectada';
  if (Math.abs(grams - GRAMS_PER_LB) < 0.01) return '1 libra';
  if (grams >= 1000) return `${n(grams / 1000, 2)} kg`;
  return `${n(grams, 0)} g`;
}

function plausibilityByArrobas(arrobas) {
  if (arrobas <= 0) return 'sin stock';
  if (arrobas < 0.25) return 'muy bajo';
  if (arrobas <= 120) return 'plausible';
  if (arrobas <= 500) return 'alto';
  return 'muy alto';
}

async function fetchAllInventory() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('inventory_master')
      .select('sku, db_source, description, unit, system_stock, is_service, needs_review, review_reason')
      .range(from, from + pageSize - 1)
      .order('db_source', { ascending: true })
      .order('sku', { ascending: true });

    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

const inventory = await fetchAllInventory();
const rows = inventory
  .filter((r) => !r.is_service && matchesTerms(r.description))
  .sort((a, b) => Math.abs(Number(b.system_stock) || 0) - Math.abs(Number(a.system_stock) || 0));

console.log(`Hipotesis de unidades para: ${TERMS.join(', ')}`);
console.log(`Coincidencias: ${rows.length}`);
console.log('');

for (const r of rows) {
  const stock = Number(r.system_stock) || 0;
  const presentationGrams = detectPresentationGrams(r.description);
  const packagesIfGrams = presentationGrams ? stock / presentationGrams : null;
  const lbsIfGrams = stock / GRAMS_PER_LB;
  const arrobasIfGrams = stock / GRAMS_PER_ARROBA;
  const arrobasIfLbs = stock / LBS_PER_ARROBA;

  console.log(`${r.db_source} ${r.sku} | ${r.description}`);
  console.log(`  ERP crudo: ${n(stock, 4)} "${r.unit || 'N/A'}"`);
  console.log(`  Presentacion detectada: ${presentationLabel(presentationGrams)}`);
  console.log(`  Hipotesis A - crudo = unidades/pquetes: ${n(stock, 2)} unidades`);
  console.log(
    `  Hipotesis B - crudo = gramos: ${n(lbsIfGrams, 2)} lb | ${n(arrobasIfGrams, 2)} arrobas` +
      (packagesIfGrams !== null ? ` | ${n(packagesIfGrams, 2)} paquetes de ${presentationLabel(presentationGrams)}` : '')
  );
  console.log(`  Hipotesis C - crudo = libras: ${n(arrobasIfLbs, 2)} arrobas`);
  console.log(`  Lectura rapida: gramos=${plausibilityByArrobas(arrobasIfGrams)} | libras=${plausibilityByArrobas(arrobasIfLbs)}`);
  if (r.needs_review) console.log(`  REVIEW actual: ${r.review_reason}`);
  console.log('');
}
