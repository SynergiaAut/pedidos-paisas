# Tasks: Sync de inventario (referencia: plan.md)

## Bloque A — Backend

- [x] **TASK-001** Fix encoding en `flex-crm.ts#post()` (UTF-8 → fallback windows-1252). Verifica: descripción "ALIÑOS" legible en `/api/milenium/productos?db=01`.
- [x] **TASK-002** `src/lib/inventory-mapper.ts` con `isService()` y `mapToInventoryRow()` puras. Verifica: tests TASK-005.
- [x] **TASK-003** Route `POST /api/milenium/sync-inventario` con `x-sync-secret`, upsert por lotes, resumen JSON. Verifica: 401 sin secret; con secret sincroniza BD1 y reporta `{synced, skipped_services}`.
- [x] **TASK-004** Migración `009_inventory_master_sync.sql` (columnas + unique `(sku, db_source)`). Verifica: aplicada en Supabase sin error, upsert repetido no duplica.

## Bloque B — QA

- [x] **TASK-005** `tests/inventory-mapper.test.mjs` (node:test). Verifica: `npm test` pasa.
- [ ] **TASK-006** Prueba manual E2E (usuario): aplicar migración → `npm run dev` → POST sync → ver productos en `/inventario` con filtro 01. Verifica: UnifiedStockTable pobla `system_stock` y `last_sync_at`.

## Bloque C — Al recibir credenciales BD2 (bloqueado por Ricardo)

- [ ] **TASK-007** Agregar `FLEX_CRM_EMAIL_02/CLAVE_02`, smoke test con "catálogos distintos", POST sync `{db:'all'}`. Verifica: `/inventario` muestra ambas bases.

## Bloque D — Endurecimiento (post-validación)

- [ ] **TASK-008** RLS de `inventory_master` (junto con hallazgo S2 de la auditoría).
- [ ] **TASK-009** Cron del sync (cada 15 min o según acuerde Ricardo) + monitoreo del health.
- [ ] **TASK-010** Baseline de migraciones (`supabase db pull`) — deuda A4.
