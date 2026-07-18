/**
 * Ejecuta sync de ventas para un rango puntual usando el endpoint local.
 * Requiere que Next este corriendo.
 *
 * Uso:
 *   node scripts/run-sales-sync-range.mjs all 2026-07-16 2026-07-17 3000
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const f of ['.env', '.env.local']) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const db = process.argv[2] || 'all';
const fi = process.argv[3];
const ff = process.argv[4] || fi;
const port = process.argv[5] || '3000';

if (!fi || !/^\d{4}-\d{2}-\d{2}$/.test(fi) || !/^\d{4}-\d{2}-\d{2}$/.test(ff)) {
  console.error('Uso: node scripts/run-sales-sync-range.mjs all 2026-07-16 2026-07-17 3000');
  process.exit(1);
}

if (!process.env.SYNC_SECRET) {
  console.error('SYNC_SECRET no configurado en .env.local/.env');
  process.exit(1);
}

console.log(`Sync ventas db=${db}, rango=${fi} -> ${ff}`);
const res = await fetch(`http://localhost:${port}/api/milenium/sync-ventas`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-sync-secret': process.env.SYNC_SECRET,
  },
  body: JSON.stringify({ db, fi, ff }),
});

const summary = await res.json();
console.log(JSON.stringify(summary, null, 2));
if (!res.ok) process.exit(1);
