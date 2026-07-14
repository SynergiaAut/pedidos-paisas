/**
 * Validacion de la API Flex CRM para el MODULO PEDIDOS. (v2 - destapa envoltorios)
 *
 * Responde: podemos capturar pedidos/facturas desde la API en vez de "Magic Paste"?
 * La API trae detalle de linea (item + cantidad) o solo cabecera?
 *
 * Uso:
 *   node scripts/validate-pedidos.mjs
 *   node scripts/validate-pedidos.mjs --desde 2026-06-01 --hasta 2026-06-30 --db 01
 *
 * Requiere: internet + tunel del ERP arriba + credenciales en .env.local.
 * NO imprime credenciales. Genera scripts/validacion-pedidos-REPORTE.json
 * y scripts/validacion-pedidos-MUESTRA.json (1 factura y 1 cliente completos).
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- args ----------
const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const fmt = (d) => d.toISOString().slice(0, 10);
const hoy = new Date();
const DESDE = getArg('desde', fmt(new Date(hoy.getTime() - 30 * 864e5)));
const HASTA = getArg('hasta', fmt(hoy));
const ONLY_DB = getArg('db', null);

// ---------- env ----------
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
let DBS = {
  '01': { label: 'BD1 (GRANESLOSPAISAS)', correo: env.FLEX_CRM_EMAIL_01 || env.FLEX_CRM_EMAIL || '', clave: env.FLEX_CRM_CLAVE_01 || env.FLEX_CRM_CLAVE || '' },
  '02': { label: 'BD2 (PAISASFISCAL)', correo: env.FLEX_CRM_EMAIL_02 || '', clave: env.FLEX_CRM_CLAVE_02 || '' },
};
if (ONLY_DB) DBS = { [ONLY_DB]: DBS[ONLY_DB] };

// ---------- helpers ----------
const LINE_KEYS = ['items', 'item', 'detalle', 'detalles', 'lineas', 'productos', 'movimientos', 'renglones', 'lines', 'detail'];

async function call(token, path, body, timeout = 120000) {
  const t0 = Date.now();
  const res = await fetch(BASE_URL + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify(body || {}), signal: AbortSignal.timeout(timeout),
  });
  const ms = Date.now() - t0;
  let data = null; try { data = await res.json(); } catch { /* noop */ }
  return { ok: res.ok, status: res.status, ms, data };
}
function pickArray(data) {
  if (!data || typeof data !== 'object') return { key: null, arr: [] };
  for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) return { key: k, arr: v };
  return { key: null, arr: [] };
}
// destapa {factura:{...}} / {customer:{...}} / {pedido:{...}} -> objeto interno
function unwrap(o) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    const ks = Object.keys(o);
    if (ks.length === 1 && o[ks[0]] && typeof o[ks[0]] === 'object' && !Array.isArray(o[ks[0]])) return o[ks[0]];
  }
  return o;
}
function field(obj, names) {
  if (!obj) return undefined;
  const low = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  for (const n of names) { const v = low[n.toLowerCase()]; if (v !== undefined && v !== null) return v; }
  return undefined;
}
// trae array de lineas anidado? devuelve {field, itemKeys, itemSample}
function findLineDetail(objRaw) {
  const obj = unwrap(objRaw);
  if (!obj || typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return { field: k, itemKeys: Object.keys(v[0]), itemSample: v[0] };
  }
  for (const [k, v] of Object.entries(obj)) {
    if (LINE_KEYS.includes(k.toLowerCase()) && Array.isArray(v)) return { field: k, itemKeys: v[0] ? Object.keys(v[0]) : [], itemSample: v[0] || null };
  }
  return null;
}
const short = (o) => { const s = JSON.stringify(o); return s.length > 700 ? s.slice(0, 700) + '...' : s; };

async function probeDb(db, cfg) {
  const out = { db, label: cfg.label, ok: false, endpoints: {}, verdict: {}, muestras: {} };
  if (!cfg.correo || !cfg.clave) { out.error = 'Credenciales no configuradas para ' + db; return out; }
  const t0 = Date.now();
  let auth;
  try {
    const r = await fetch(BASE_URL + '/crm/empresa/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: cfg.correo, clave: cfg.clave }), signal: AbortSignal.timeout(30000) });
    auth = await r.json();
    if (!r.ok || !auth || !auth.ok || !auth.token) { out.error = 'Login fallido: ' + (auth && auth.message || r.status); return out; }
  } catch (e) { out.error = 'Sin conexion al login: ' + e.message; return out; }
  const token = auth.token;
  out.login_ms = Date.now() - t0; out.empresa = auth.usuario && auth.usuario.razon_social; out.nit = auth.usuario && auth.usuario.nit;

  const analyzeList = async (path, body) => {
    const r = await call(token, path, body);
    const { key, arr } = pickArray(r.data);
    const first = arr[0] ? unwrap(arr[0]) : null;
    const det = arr[0] ? findLineDetail(arr[0]) : null;
    return { first, det, rawFirst: arr[0] || null,
      info: { status: r.status, ms: r.ms, ok: r.ok && !!(r.data && r.data.ok), arrayKey: key, count: arr.length,
        keys: first ? Object.keys(first) : [], lineField: det ? det.field : null, itemKeys: det ? det.itemKeys : null,
        sample: first ? short(first) : null, error: r.data && r.data.message } };
  };

  try { const a = await analyzeList('/crm/all/order', { fechainicial: DESDE, fechafinal: HASTA }); out.endpoints.order_all = a.info; out._po = a.first; out._poDet = a.det; if (a.rawFirst) out.muestras.pedido = a.rawFirst; }
  catch (e) { out.endpoints.order_all = { error: e.message }; }

  try { const a = await analyzeList('/crm/all/invoice', { fechainicial: DESDE, fechafinal: HASTA }); out.endpoints.invoice_all = a.info; out._fv = a.first; out._fvDet = a.det; if (a.rawFirst) out.muestras.factura = a.rawFirst; }
  catch (e) { out.endpoints.invoice_all = { error: e.message }; }

  const fvNum = field(out._fv, ['numero', 'numero_doc', 'num']);
  const fvTipo = field(out._fv, ['tipodoc', 'id_tipo_doc', 'tipo']);
  if (fvNum) {
    try {
      const r = await call(token, '/crm/one/invoice', { tipodoc: String(fvTipo == null ? '' : fvTipo), numero: String(fvNum) });
      const { arr } = pickArray(r.data);
      const det = findLineDetail(arr.length ? arr[0] : r.data);
      out.endpoints.invoice_one = { status: r.status, ms: r.ms, ok: r.ok && !!(r.data && r.data.ok), probe: { tipodoc: String(fvTipo == null ? '' : fvTipo), numero: String(fvNum) }, lineField: det ? det.field : null, itemKeys: det ? det.itemKeys : null, sample: short(unwrap(arr[0]) || r.data) };
    } catch (e) { out.endpoints.invoice_one = { error: e.message }; }
  }

  try { const a = await analyzeList('/crm/all/customer', {}); out.endpoints.customer_all = a.info; if (a.rawFirst) out.muestras.cliente = a.rawFirst; }
  catch (e) { out.endpoints.customer_all = { error: e.message }; }

  const oa = out.endpoints.order_all, ia = out.endpoints.invoice_all;
  out.verdict.captura_desde_api = !!((oa && oa.count) || (ia && ia.count));
  out.verdict.fuente_recomendada = ((ia && ia.count) || 0) >= ((oa && oa.count) || 0) ? 'facturas (/crm/all/invoice)' : 'pedidos (/crm/all/order)';
  out.verdict.detalle_linea_pedido = !!out._poDet;
  out.verdict.detalle_linea_factura = !!(out._fvDet || (out.endpoints.invoice_one && out.endpoints.invoice_one.lineField));
  out.verdict.reconciliacion_por_sku_posible = out.verdict.detalle_linea_pedido || out.verdict.detalle_linea_factura;
  delete out._po; delete out._fv; delete out._poDet; delete out._fvDet;
  out.ok = true;
  return out;
}

// ---------- run ----------
console.log('\n=== Validacion PEDIDOS - Flex CRM - ' + BASE_URL);
console.log('    Rango: ' + DESDE + ' -> ' + HASTA + '   -   ' + new Date().toISOString() + '\n');
const results = [];
for (const [db, cfg] of Object.entries(DBS)) {
  process.stdout.write('> ' + cfg.label + ' ... ');
  const r = await probeDb(db, cfg); results.push(r);
  console.log(r.ok ? 'listo' : 'ERROR (' + r.error + ')');
}
for (const r of results) {
  console.log('\n----------------------------------------------');
  console.log('[' + r.db + '] ' + r.label);
  if (!r.ok) { console.log('  X ' + r.error); continue; }
  console.log('  OK Login ' + r.login_ms + 'ms - ' + (r.empresa || '?') + ' (NIT ' + (r.nit || '?') + ')');
  const show = (name, e) => {
    if (!e) return;
    if (e.error) { console.log('  - ' + name + ': X ' + e.error); return; }
    const det = e.lineField ? 'LINEAS en "' + e.lineField + '"' : (e.arrayKey ? 'sin lineas en cabecera' : '');
    console.log('  - ' + name + ': HTTP ' + e.status + ' ' + e.ms + 'ms - campo="' + e.arrayKey + '" count=' + e.count + ' ' + det);
    if (e.keys && e.keys.length) console.log('      cabecera: ' + e.keys.join(', '));
    if (e.itemKeys && e.itemKeys.length) console.log('      linea (item): ' + e.itemKeys.join(', '));
    if (e.sample) console.log('      muestra: ' + e.sample);
  };
  show('all/order   ', r.endpoints.order_all);
  show('all/invoice ', r.endpoints.invoice_all);
  show('one/invoice ', r.endpoints.invoice_one);
  show('all/customer', r.endpoints.customer_all);
  console.log('  VEREDICTO:');
  console.log('    - Capturar desde API: ' + (r.verdict.captura_desde_api ? 'SI' : 'NO') + '  ->  fuente: ' + r.verdict.fuente_recomendada);
  console.log('    - Detalle de linea en factura: ' + (r.verdict.detalle_linea_factura ? 'SI' : 'NO'));
  console.log('    - Detalle de linea en pedido:  ' + (r.verdict.detalle_linea_pedido ? 'SI' : 'NO (o sin pedidos)'));
  console.log('    - Reconciliacion por SKU posible: ' + (r.verdict.reconciliacion_por_sku_posible ? 'SI' : 'NO -> pedir endpoint a Ricardo'));
}
const clean = results.map(({ muestras, ...rest }) => rest);
writeFileSync(resolve(root, 'scripts', 'validacion-pedidos-REPORTE.json'), JSON.stringify({ generado: new Date().toISOString(), rango: { DESDE, HASTA }, base: BASE_URL, results: clean }, null, 2));
writeFileSync(resolve(root, 'scripts', 'validacion-pedidos-MUESTRA.json'), JSON.stringify(results.map((r) => ({ db: r.db, muestras: r.muestras })), null, 2));
console.log('\n[archivo] Reporte:  scripts/validacion-pedidos-REPORTE.json');
console.log('[archivo] Muestras: scripts/validacion-pedidos-MUESTRA.json  (1 factura + 1 cliente completos, con lineas)\n');
