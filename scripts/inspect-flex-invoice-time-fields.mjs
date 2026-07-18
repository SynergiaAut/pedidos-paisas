/**
 * Inspecciona campos de tiempo disponibles en facturas Flex CRM.
 * No escribe datos.
 *
 * Uso:
 *   node scripts/inspect-flex-invoice-time-fields.mjs 2026-07-18 2026-07-18
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

const fi = process.argv[2] || '2026-07-18';
const ff = process.argv[3] || fi;
const timePattern = /(hora|time|fecha|created|updated|registro|emision|captura|modifica|despacho)/i;

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

async function getInvoices(token) {
  const res = await fetch(`${BASE_URL}/crm/all/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify({ fechainicial: fi, fechafinal: ff }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json();
  return data?.invoices || [];
}

for (const [db, cfg] of Object.entries(DBS)) {
  console.log(`\n=== BD${db} ${fi} -> ${ff} ===`);
  if (!cfg.correo || !cfg.clave) {
    console.log('sin credenciales');
    continue;
  }

  const token = await login(cfg);
  const invoices = await getInvoices(token);
  console.log(`facturas=${invoices.length}`);

  const docs = invoices.slice(0, 5).map((wrapper) => wrapper.factura || wrapper);
  for (const [idx, doc] of docs.entries()) {
    const docFields = Object.fromEntries(
      Object.entries(doc).filter(([key]) => timePattern.test(key) && key !== 'items')
    );
    console.log(`doc ${idx + 1}`, JSON.stringify(docFields));

    const firstItem = Array.isArray(doc.items) ? doc.items[0] : null;
    if (firstItem) {
      const itemFields = Object.fromEntries(
        Object.entries(firstItem).filter(([key]) => timePattern.test(key))
      );
      console.log(`item ${idx + 1}`, JSON.stringify(itemFields));
    }
  }

  const allKeys = new Set();
  const allItemKeys = new Set();
  const dispatchTimes = new Map();
  const sellers = new Map();
  for (const wrapper of invoices) {
    const doc = wrapper.factura || wrapper;
    Object.keys(doc).forEach((key) => allKeys.add(key));
    if (doc.FECHA_DESPACHO) {
      dispatchTimes.set(doc.FECHA_DESPACHO, (dispatchTimes.get(doc.FECHA_DESPACHO) || 0) + 1);
    }
    const sellerKey = `${doc.ID_VENDEDOR ?? 'SIN_ID'} | ${doc.NOMBRE_VENDEDOR ?? 'SIN_NOMBRE'}`;
    sellers.set(sellerKey, (sellers.get(sellerKey) || 0) + 1);
    const firstItem = Array.isArray(doc.items) ? doc.items[0] : null;
    if (firstItem) Object.keys(firstItem).forEach((key) => allItemKeys.add(key));
  }
  console.log('docKeys', [...allKeys].sort().join(', '));
  console.log('itemKeys', [...allItemKeys].sort().join(', '));
  console.log('FECHA_DESPACHO muestras', [...dispatchTimes.entries()].slice(0, 20).map(([value, count]) => `${value} (${count})`).join(' | '));
  console.log('Vendedores muestras', [...sellers.entries()].map(([value, count]) => `${value} (${count})`).join(' | '));
}
