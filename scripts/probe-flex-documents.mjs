/**
 * Prueba directa de documentos Flex CRM por endpoint, base y formato de fecha.
 * No escribe datos.
 *
 * Uso:
 *   node scripts/probe-flex-documents.mjs 2026-07-16 2026-07-17
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const f of ['.env', '.env.local']) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE_URL = env.FLEX_CRM_URL || 'https://me.services.ibla.co';
const DBS = {
  '01': { correo: env.FLEX_CRM_EMAIL_01 || env.FLEX_CRM_EMAIL || '', clave: env.FLEX_CRM_CLAVE_01 || env.FLEX_CRM_CLAVE || '' },
  '02': { correo: env.FLEX_CRM_EMAIL_02 || '', clave: env.FLEX_CRM_CLAVE_02 || '' },
};

const fiIso = process.argv[2] || '2026-07-16';
const ffIso = process.argv[3] || fiIso;

function toDmy(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function login(cfg) {
  const res = await fetch(`${BASE_URL}/crm/empresa/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: cfg.correo, clave: cfg.clave }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  if (!data?.token) throw new Error(data?.message || `HTTP ${res.status}`);
  return data.token;
}

async function post(token, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, parseError: text.slice(0, 300) };
  }
  return { ok: res.ok && data.ok !== false, status: res.status, data };
}

function countDocs(path, data) {
  if (path.includes('invoice')) return data?.invoices?.length ?? 0;
  if (path.includes('order')) return data?.pedidos?.length ?? 0;
  return 0;
}

function sampleDoc(path, data) {
  const arr = path.includes('invoice') ? data?.invoices : data?.pedidos;
  const first = arr?.[0];
  if (!first) return null;
  const doc = first.factura || first.pedido || first;
  return {
    keys: Object.keys(doc).slice(0, 12),
    fecha: doc.FECHA || doc.fecha,
    tipo: doc.ID_TIPO_DOC || doc.tipodoc,
    numero: doc.NUMERO || doc.numero,
    total: doc.TOTAL || doc.total,
    items: Array.isArray(doc.items) ? doc.items.length : undefined,
  };
}

const bodies = [
  { label: 'ISO', body: { fechainicial: fiIso, fechafinal: ffIso } },
  { label: 'DMY', body: { fechainicial: toDmy(fiIso), fechafinal: toDmy(ffIso) } },
];
const paths = ['/crm/all/invoice', '/crm/all/order'];

console.log(`Probe Flex CRM docs ${fiIso} -> ${ffIso}`);
for (const [db, cfg] of Object.entries(DBS)) {
  console.log(`\n=== BD${db} ===`);
  if (!cfg.correo || !cfg.clave) {
    console.log('sin credenciales');
    continue;
  }
  try {
    const token = await login(cfg);
    for (const path of paths) {
      for (const variant of bodies) {
        const result = await post(token, path, variant.body);
        const count = countDocs(path, result.data);
        const sample = sampleDoc(path, result.data);
        console.log(`${path} ${variant.label} ${JSON.stringify(variant.body)} -> status=${result.status} ok=${result.ok} count=${count}`);
        if (sample) console.log(`  sample=${JSON.stringify(sample)}`);
        if (!result.ok && result.data?.message) console.log(`  message=${result.data.message}`);
      }
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
}
