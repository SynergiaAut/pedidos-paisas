/**
 * Diagnostico: por que el system_stock de BD2 se infla.
 * Compara el arreglo stock[] (por bodega) de un SKU en BD1 vs BD2.
 * Uso:  node scripts/debug-stock-bd2.mjs [SKU]   (por defecto 2301005 = ARROZ BOLUGA)
 * No cambia nada. Requiere internet + tunel + credenciales en .env.local.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKU = process.argv[2] || '2301005';

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

async function login(cfg) {
  const r = await fetch(BASE_URL + '/crm/empresa/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: cfg.correo, clave: cfg.clave }), signal: AbortSignal.timeout(30000),
  });
  const a = await r.json();
  if (!a || !a.token) throw new Error('login fallido: ' + (a && a.message));
  return a.token;
}

for (const [db, cfg] of Object.entries(DBS)) {
  console.log('\n==================== BD' + (db === '01' ? '1' : '2') + ' (' + db + ') ====================');
  if (!cfg.correo || !cfg.clave) { console.log('  sin credenciales, se omite'); continue; }
  try {
    const token = await login(cfg);
    const r = await fetch(BASE_URL + '/crm/all/product', {
      method: 'POST', headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({}), signal: AbortSignal.timeout(120000),
    });
    const data = await r.json();
    const arr = data.products || [];
    const hit = arr.find((x) => {
      const p = x.producto || x;
      return String(p.ID_ITEM) === String(SKU);
    });
    if (!hit) { console.log('  SKU ' + SKU + ' no encontrado (' + arr.length + ' productos)'); continue; }
    const p = hit.producto || hit;
    const stock = p.stock || [];
    console.log('  SKU ' + SKU + ' — ' + (p.DESCRIPCION_ITEM || ''));
    console.log('  entradas en stock[]: ' + stock.length);
    const suma = stock.reduce((s, x) => s + (Number(x.CANTIDAD) || 0), 0);
    console.log('  SUMA de CANTIDAD (lo que guarda hoy el sync): ' + suma);
    // agrupar por bodega para ver duplicados
    const porBodega = {};
    for (const s of stock) {
      const b = String(s.ID_BODEGA);
      porBodega[b] = (porBodega[b] || 0) + 1;
    }
    const dupes = Object.entries(porBodega).filter(([, n]) => n > 1);
    console.log('  bodegas distintas: ' + Object.keys(porBodega).length + ' | bodegas repetidas: ' + dupes.length);
    console.log('  primeras 10 entradas:');
    stock.slice(0, 10).forEach((s, i) => console.log('    ' + (i + 1) + ') ID_BODEGA=' + s.ID_BODEGA + '  CANTIDAD=' + s.CANTIDAD));
    if (dupes.length) console.log('  >>> HAY BODEGAS REPETIDAS: ' + dupes.slice(0, 5).map(([b, n]) => b + ' x' + n).join(', '));
  } catch (e) {
    console.log('  ERROR: ' + e.message);
  }
}
console.log('');
