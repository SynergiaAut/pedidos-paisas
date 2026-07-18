/**
 * Auditoria rapida de cobertura para las graficas de comportamiento.
 * No modifica datos.
 */
import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAll(table, select, orderColumn) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

const daily = await fetchAll('sales_lines', 'fecha, db_source, total, cantidad', 'fecha');

const byDate = new Map();
for (const row of daily || []) {
  const key = row.fecha;
  const current = byDate.get(key) || { fecha: key, rows: 0, venta: 0, unidades: 0, bd01: 0, bd02: 0 };
  current.rows += 1;
  current.venta += Number(row.total) || 0;
  current.unidades += Number(row.cantidad) || 0;
  if (row.db_source === '01') current.bd01 += Number(row.total) || 0;
  if (row.db_source === '02') current.bd02 += Number(row.total) || 0;
  byDate.set(key, current);
}

const days = Array.from(byDate.values());
console.log(`sales_lines filas=${daily?.length || 0}; dias_con_ventas=${days.length}`);
console.log(`rango=${days[0]?.fecha || 'N/A'} -> ${days[days.length - 1]?.fecha || 'N/A'}`);
console.log('Ultimos 15 dias con datos:');
for (const d of days.slice(-15)) {
  console.log(`${d.fecha} | filas=${d.rows} | venta=${Math.round(d.venta).toLocaleString('es-CO')} | und=${d.unidades.toLocaleString('es-CO')} | bd01=${Math.round(d.bd01).toLocaleString('es-CO')} | bd02=${Math.round(d.bd02).toLocaleString('es-CO')}`);
}

const snapshots = await fetchAll('sales_snapshots', 'dia, captured_at, db_source, venta, unidades', 'captured_at');
const snapByDay = new Map();
for (const row of snapshots || []) {
  const current = snapByDay.get(row.dia) || { dia: row.dia, rows: 0, first: row.captured_at, last: row.captured_at, maxVenta: 0 };
  current.rows += 1;
  current.last = row.captured_at;
  current.maxVenta = Math.max(current.maxVenta, Number(row.venta) || 0);
  snapByDay.set(row.dia, current);
}
const snapDays = Array.from(snapByDay.values());
console.log(`\nsales_snapshots filas=${snapshots?.length || 0}; dias_con_snapshots=${snapDays.length}`);
for (const d of snapDays.slice(-10)) {
  console.log(`${d.dia} | filas=${d.rows} | first=${d.first} | last=${d.last} | maxVenta=${Math.round(d.maxVenta).toLocaleString('es-CO')}`);
}
