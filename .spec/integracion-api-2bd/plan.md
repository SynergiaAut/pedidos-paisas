# Plan Técnico: Sync de inventario API Flex CRM → inventory_master

**Referencia:** `spec.md` (clarifications 2026-07-11). Alcance inmediato: BD1 operativa; BD2 se activa sola al agregar credenciales (el código ya es multi-BD).

## Componentes

### 1. Decodificación tolerante a encoding (fix "ALI◆OS")
**Archivo:** `src/lib/flex-crm.ts` → método `post()`.
La API declara UTF-8 pero envía bytes latin1 (Ñ=0xD1 → U+FFFD). Solución local (sin esperar a Ricardo): leer `arrayBuffer`, decodificar UTF-8; si el texto contiene `�`, re-decodificar como `windows-1252`. Cuando Ricardo corrija el charset, el fallback simplemente deja de activarse.

### 2. Mapper puro (testeable)
**Archivo nuevo:** `src/lib/inventory-mapper.ts` — funciones puras, sin I/O:
- `isService(p)`: `stock_por_bodega` vacío o todas las bodegas `null` y clasificación tipo FLETE → no es inventario físico.
- `mapToInventoryRow(p: CrmProductTagged)`: → fila `inventory_master`:

| Columna | Fuente |
|---|---|
| `db_source` | tag '01'/'02' |
| `item_id` | `parseInt(sku)` (compat UI) |
| `sku` | `ID_ITEM` (string, conserva ceros) |
| `barcode` | `REFERENCIA` (EAN) o null |
| `description` | `DESCRIPCION_ITEM` |
| `system_stock` | `existencia_total` |
| `cost_avg`, `classification`, `brand`, `unit` | payload |
| `stock_by_warehouse` | jsonb `stock_por_bodega` |
| `is_service` | `isService()` |
| `last_sync_at` | now() |

**Nunca escribe `physical_stock`** (pertenece a los conteos físicos).

### 3. Endpoint de sync
**Archivo nuevo:** `src/app/api/milenium/sync-inventario/route.ts`
- `POST` con body opcional `{ "db": "01" | "02" | "all" }` (default all).
- Protección: header `x-sync-secret` == `process.env.SYNC_SECRET` (nueva var).
- Flujo: fetch productos (tolerante a fallo parcial) → map → upsert a Supabase en lotes de 500 con `onConflict: 'sku,db_source'` → respuesta con resumen `{synced_by_db, skipped_services, errors, duration_ms}`.
- Programación: manual por ahora (botón/cURL); cron cada 15 min cuando se resuelva la latencia con Ricardo.

### 4. Migración de datos
**Archivo nuevo:** `supabase/migrations/009_inventory_master_sync.sql` (idempotente):
- `create table if not exists inventory_master` (por si el entorno es nuevo).
- `add column if not exists`: `cost_avg`, `classification`, `brand`, `unit`, `stock_by_warehouse jsonb`, `is_service boolean`, `last_sync_at`.
- **Unique index `(sku, db_source)`** — requisito del upsert idempotente.
- RLS queda para la tarea de seguridad S2 (no se toca aquí).

### 5. Tests (sin dependencias nuevas)
**Archivo nuevo:** `tests/inventory-mapper.test.mjs` con `node:test` + `--experimental-strip-types` (Node 22).
Casos: producto normal, servicio (DOMICILIO), stock multi-bodega, referencia vacía → barcode null, sku con ceros a la izquierda, payload malformado.
Script npm: `"test": "node --experimental-strip-types --test tests/"`.

## Riesgos
1. `inventory_master` existente puede tener constraint distinto → la migración crea el unique index solo si no existe; si hay duplicados previos, limpiarlos antes (query incluida en la migración como comentario).
2. RLS actual de la tabla desconocido: si bloquea el upsert del route handler, aparecerá en el resumen de errores — resolver junto con S2.
3. Latencia API (12–34 s): el sync es async y tolerante; no bloquear UI esperando.

## Dependencias
`SYNC_SECRET` en `.env.local` y `.env.example`. Migración 009 aplicada en Supabase antes del primer sync.
