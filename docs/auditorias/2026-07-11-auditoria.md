# Auditoría Técnica — Pedidos Paisas · 11 jul 2026

Auditoría con enfoque Arquitectura + QA + DevSecOps + SDD, motivada por el cambio de panorama: la integración con Milenium queda **exclusivamente vía API Flex CRM** (2 usuarios, uno por base de datos). Las vías alternas se retiran.

## 1. Hallazgos de Seguridad (DevSecOps)

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| S1 | 🔴 Crítica | **Clave privada SSH `id_tunnel` versionada en git** (raíz del repo). Cualquiera con acceso al repo puede autenticarse al túnel. | Retirada del working tree (→ `_archive/secrets/id_tunnel.ROTAR`, gitignored). **Pendiente: rotar la clave con Ricardo y purgar el historial** (ver §5). |
| S2 | 🔴 Crítica | **RLS deshabilitado o abierto**: `disable_rls_temp.sql` desactiva RLS en `clients`; `orders` tiene policies `to public` de lectura/escritura/update (migración 001: "for Development Speed"). Cualquiera con la anon key puede leer y modificar pedidos y clientes. | Pendiente — requiere diseño de policies (tarea en SPEC). |
| S3 | 🟠 Alta | Credenciales Firebird hardcodeadas (`SYSDBA`/`masterkey`) en `probe.js`, `scripts/analyze-milenium.js`, `test-milenium-db.js` y como default en `firebird.ts`. | Archivados en `_archive/` (fuera del código activo). La contraseña real del Firebird del cliente debe cambiarse igualmente (es la default de fábrica). |
| S4 | 🟡 Media | `.env`/`.env.local` correctamente gitignorados y nunca commiteados ✅, pero no existe `.env.example` — los secretos requeridos no están documentados. | Pendiente (tarea rápida). |
| S5 | 🟡 Media | Backups reales del cliente (`BK Paisas/*.FDB`, datos personales sujetos a Ley 1581/2012) y el export del chat de WhatsApp viven dentro de la carpeta del proyecto. Gitignorados, pero recomendable moverlos fuera del repo. | Recomendación (decisión tuya). |
| S6 | 🟡 Media | El registro público por QR permite `insert` anónimo ilimitado en `clients` (sin rate limit ni captcha). | Pendiente — mitigar en fase 2. |

## 2. Hallazgos de Arquitectura

| # | Hallazgo | Acción |
|---|---|---|
| A1 | **Tres vías de datos coexistían** para el mismo propósito: API Flex CRM (`flex-crm.ts`), Firebird directo por túnel (`firebird.ts` + `workers/`) y agente de spooler (`milenium-agent/`). Los workers no eran invocados por nadie (código muerto). | ✅ Archivadas las vías 2 y 3 en `_archive/`. Vía única: **API Flex CRM**. |
| A2 | `lib/db.ts` (conexión `pg` directa a Supabase, workaround del cache REST) sin ningún import. | ✅ Archivado. Si el problema de cache reaparece, la solución correcta es `NOTIFY pgrst, 'reload schema'` o revisar el schema cache, no un segundo canal de acceso. |
| A3 | `flex-crm.ts` es singleton con **un solo token/credencial** — incompatible con el acuerdo de 2 usuarios (BD1/BD2). | Refactor definido en `.spec/integracion-api-2bd/`. |
| A4 | SQL de Supabase disperso: migraciones numeradas + 10 archivos sueltos de fixes (`fix_permissions_final.sql`, `rpc_register_v2.sql`, etc.) sin saber cuáles están aplicados. | Pendiente: consolidar el esquema real como baseline (`supabase db pull`) y borrar los sueltos. |
| A5 | `ADR_001` desactualizado: no menciona Milenium, la API, ni el módulo de inventario. | ✅ Reemplazado por `docs/01-arquitectura.md` + constitución SDD. `ADR_001` se conserva como histórico. |
| A6 | Artefactos de build versionados/presentes: `tsconfig.tsbuildinfo`, `.next/` (gitignored pero pesado). | ✅ `tsbuildinfo` eliminado y ya está en `.gitignore`. |

## 3. Hallazgos de QA

| # | Hallazgo | Acción |
|---|---|---|
| Q1 | **Cero tests** en todo el proyecto. Los puntos más frágiles y críticos: el parser "Magic Paste" (regex sobre texto de factura) y el futuro mapeo API→`inventory_master`. | Plan de testing en la constitución (Art. 5): Vitest, prioridad 1 = parser de facturas con casos reales, prioridad 2 = mapeo/upsert de inventario, prioridad 3 = contrato contra `docs/infra/flex-crm-openapi.yml`. |
| Q2 | Sin CI: nada impide mergear código roto. | Pendiente: GitHub Actions con `lint + tsc + vitest` (cuando haya remoto). |
| Q3 | Archivos `.bak` y "Nuevo Documento de texto.txt" versionados — señal de edición sin disciplina de branches. | ✅ Eliminados. Regla en constitución: nunca versionar `.bak`. |
| Q4 | Health check existe (`/api/milenium/health`) ✅ pero nadie lo monitorea. | Sugerencia: cron/uptime monitor apuntando al health + alerta si el token no renueva. |

## 4. Depuración aplicada hoy

```
_archive/
├── LEAME.md                  ← por qué está aquí cada cosa
├── firebird-directo/         ← firebird.ts, workers (inventory-sync, milenium-polling), db-pg-directo.ts
├── milenium-agent/           ← agente Python de spooler completo
├── scripts-exploracion/      ← probe.js, analyze-milenium.js, test-milenium-db.js, simulate-print.js, simular_impresion.bat
└── secrets/id_tunnel.ROTAR   ← clave SSH retirada (ROTAR con Ricardo)
```

Eliminados: `page.tsx.bak`, `commit_msg.txt`, `codigo.txt`, `prueba.txt`, `Nuevo Documento de texto.txt`, `.lnk`, `tsconfig.tsbuildinfo`, `scripts/` (lo útil se movió a `docs/infra/`).

Reubicados: manual del túnel y scripts `.ps1` → `docs/infra/` (siguen vigentes: la API depende del túnel del lado servidor); `openapi.yml` y `milenium_schema.json` → `docs/infra/`; brief de reunión → `docs/reuniones/`.

Verificación: `grep` de imports rotos sobre `src/` = limpio. El índice de git se corrompió por el montaje durante la limpieza y **fue reparado** (`git reset`); el historial nunca estuvo en riesgo.

## 5. Acciones pendientes priorizadas

1. **[Hoy] Rotar la clave del túnel**: generar clave nueva en el servidor del granero, pedir a Ricardo que reemplace `authorized_keys`. La actual está en el historial de git.
2. **[Hoy] Revisar y commitear esta depuración** (`git add -A` + commit). Opcional pero recomendado si el repo se comparte: purgar `id_tunnel` del historial con `git filter-repo --invert-paths --path id_tunnel` (el remoto requiere force-push).
3. **[Esta semana] RLS real** en `orders`, `clients`, `invoice_events`, `delivery_drivers` (policies por rol authenticated; `clients` insert anónimo solo vía RPC con validación).
4. **[Esta semana] Refactor multi-BD de `flex-crm.ts`** según `.spec/integracion-api-2bd/`.
5. **[Esta semana] `.env.example`** documentando todas las variables.
6. **[Próxima] Consolidar migraciones Supabase** como baseline única.
7. **[Próxima] Vitest + tests del parser Magic Paste.**
8. **[Cuando Ricardo confirme]** Cambiar contraseña `masterkey` del Firebird del cliente.
