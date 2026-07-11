/**
 * Smoke test de la integración Flex CRM con 2 bases de datos.
 * Uso:  node scripts/smoke-flex-crm.mjs
 * Lee credenciales de .env.local / .env (FLEX_CRM_EMAIL_01/_02, con fallback legacy para 01).
 * Valida: login por base, catálogo de productos por base, y que 01 ≠ 02.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- Cargar .env / .env.local (sin dependencias) ---
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
    '01': {
        label: 'GRANESLOSPAISAS',
        correo: env.FLEX_CRM_EMAIL_01 || env.FLEX_CRM_EMAIL || '',
        clave: env.FLEX_CRM_CLAVE_01 || env.FLEX_CRM_CLAVE || '',
    },
    '02': {
        label: 'PAISASFISCAL',
        correo: env.FLEX_CRM_EMAIL_02 || '',
        clave: env.FLEX_CRM_CLAVE_02 || '',
    },
};

async function probe(db, { label, correo, clave }) {
    const out = { db, label, ok: false };
    if (!correo || !clave) {
        out.error = `Credenciales no configuradas (FLEX_CRM_EMAIL_${db} / FLEX_CRM_CLAVE_${db})`;
        return out;
    }
    const t0 = Date.now();
    try {
        const login = await fetch(`${BASE_URL}/crm/empresa/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, clave }),
            signal: AbortSignal.timeout(30000),
        });
        const auth = await login.json();
        if (!login.ok || !auth.ok || !auth.token) {
            out.error = `Login fallido: ${auth.message || login.status}`;
            return out;
        }
        out.login_ms = Date.now() - t0;
        out.empresa = auth.usuario?.razon_social;
        out.nit = auth.usuario?.nit;

        // La consulta viaja API -> tunel SSH -> Firebird: puede ser lenta y variable.
        // Timeout amplio (120s) + 1 reintento.
        const t1 = Date.now();
        let res, data;
        for (let intento = 1; intento <= 2; intento++) {
            try {
                res = await fetch(`${BASE_URL}/crm/all/product`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', token: auth.token },
                    body: JSON.stringify({}),
                    signal: AbortSignal.timeout(120000),
                });
                data = await res.json();
                break;
            } catch (e) {
                if (intento === 2) throw e;
                console.log(`  … [${db}] productos lento/timeout, reintentando (2/2)...`);
            }
        }
        if (!res.ok || !data.ok) {
            out.error = `Login OK pero /crm/all/product falló: ${data.message || res.status} (¿túnel SSH caído?)`;
            return out;
        }
        out.products_ms = Date.now() - t1;
        out.product_count = data.products?.length ?? 0;
        // Mostrar la estructura REAL del payload (el contrato OpenAPI puede estar desactualizado)
        if (data.products?.[0]) {
            out.keys = Object.keys(data.products[0]);
            out.sample = data.products.slice(0, 2).map((p) => JSON.stringify(p));
        }
        out.ok = true;
    } catch (e) {
        out.error = `Sin conexión: ${e.message}`;
    }
    return out;
}

console.log(`\n=== Smoke test Flex CRM · ${BASE_URL} · ${new Date().toISOString()} ===\n`);
const results = await Promise.all(Object.entries(DBS).map(([db, cfg]) => probe(db, cfg)));

for (const r of results) {
    console.log(`[${r.db}] ${r.label}`);
    if (r.ok) {
        console.log(`  ✅ Login OK (${r.login_ms}ms) — ${r.empresa ?? '?'} (NIT ${r.nit ?? '?'})`);
        console.log(`  ✅ Productos: ${r.product_count} (${r.products_ms}ms)`);
        if (r.keys) console.log(`  📋 Campos reales: ${r.keys.join(', ')}`);
        r.sample?.forEach((s) => console.log(`     · ${s}`));
    } else {
        console.log(`  ❌ ${r.error}`);
    }
    console.log();
}

const [a, b] = results;
if (a.ok && b.ok) {
    if (a.product_count === b.product_count) {
        console.log(`⚠️  ALERTA: ambas bases devuelven ${a.product_count} productos. Verificar con muestras — si el catálogo es idéntico, el usuario 02 apunta a la misma BD (reportar a Ricardo).`);
    } else {
        console.log(`✅ PRUEBA DE ACEPTACIÓN OK: catálogos distintos (01: ${a.product_count} vs 02: ${b.product_count}). Integración 2 BDs lista.`);
    }
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
