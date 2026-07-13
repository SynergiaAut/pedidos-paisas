# Tasks: Sync de inventario (referencia: plan.md)

## Bloque A — Backend

- [x] **TASK-001** Fix encoding en `flex-crm.ts#post()` (UTF-8 → fallback windows-1252). Verifica: descripción "ALIÑOS" legible en `/api/milenium/productos?db=01`.
- [x] **TASK-002** `src/lib/inventory-mapper.ts` con `isService()` y `mapToInventoryRow()` puras. Verifica: tests TASK-005.
- [x] **TASK-003** Route `POST /api/milenium/sync-inventario` con `x-sync-secret`, upsert por lotes, resumen JSON. Verifica: 401 sin secret; con secret sincroniza BD1 y reporta `{synced, skipped_services}`.
- [x] **TASK-004** Migración `009_inventory_master_sync.sql` (columnas + unique `(sku, db_source)`). Verifica: aplicada en Supabase sin error, upsert repetido no duplica.

## Bloque B — QA

- [x] **TASK-005** `tests/inventory-mapper.test.mjs` (node:test). Verifica: `npm test` pasa.
- [x] **TASK-006** Prueba manual E2E ✅ 2026-07-11: sync BD1 (2.145/451 servicios), UI con stats reales, tabla poblada, RLS + middleware endurecidos, migraciones 009–013 aplicadas.

## Bloque C — Al recibir credenciales BD2 (bloqueado por Ricardo)

- [ ] **TASK-007** Agregar `FLEX_CRM_EMAIL_02/CLAVE_02`, smoke test con "catálogos distintos", POST sync `{db:'all'}`. Verifica: `/inventario` muestra ambas bases.

## Bloque D — Endurecimiento (post-validación)

- [ ] **TASK-008** RLS de `inventory_master` (junto con hallazgo S2 de la auditoría).
- [ ] **TASK-009** Cron del sync cada 15 min — implementación concreta movida a Bloque F (TASK-014 a TASK-016) tras hallazgo de Johnathan sobre stock desactualizado durante conteos en horario de venta.
- [ ] **TASK-010** Baseline de migraciones (`supabase db pull`) — deuda A4.
- [x] **TASK-011** Conteo móvil por link (metodología original): cada inventario nuevo genera un link/token público para contar desde celulares en bodega (patrón registro QR). Requiere spec propia: `.spec/conteo-movil/` — sesión con token, vista móvil de captura, RLS insert-only sobre `inventory_counts` vía RPC, expiración del link al cerrar la sesión. Completado e implementado el 2026-07-12 (TASK-M01 a TASK-M14 ejecutadas).

## Bloque E — Fix real de encoding (hallazgo 2026-07-12, TASK-001 incompleto)

- [x] **TASK-012** `flex-crm.ts#post()`: el fallback actual re-decodifica **todo el buffer** de la respuesta como windows-1252 si aparece un solo `` en cualquier parte (línea ~223-226). Como `/crm/all/product` devuelve los 2.145 productos en una sola respuesta, un solo byte mal codificado en un producto daña la decodificación de **todos los demás** productos que sí venían en UTF-8 válido (síntoma: "Ñ" correctamente codificada en UTF-8 se re-lee como cp1252 y se ve "Ã'" — ej. "BOCADILLO VELEÃ'O", "APERITIVO GUARAQUEÃ'O"). Reemplazar la lógica global por una reparación dirigida por campo: decodificar siempre como UTF-8 primero; luego, sobre cada string de descripción, aplicar una función `repairMojibake()` que solo corrige el string que efectivamente tenga el patrón de mojibake (`Ã` seguido de los bytes típicos de re-codificación: Ã', Ã¡, Ã©, Ã­, Ã³, Ãº, Â¿, Â¡, etc.) sin tocar los strings que ya están bien. Verifica: sync completo de BD1 no introduce ningún "Ã" nuevo en `inventory_master.description`, y "ALIÑOS"/"BOCADILLO VELEÑO"/"GUARAQUEÑO" se ven correctos tras re-sincronizar.
- [x] **TASK-013** Auditoría sistemática (no incremental) de `cost_avg`: `select sku, description, cost_avg from inventory_master where is_service = false and (cost_avg > 5000000 or cost_avg < 0) order by abs(cost_avg) desc` — traer la lista completa (hoy se han encontrado 3 casos por hallazgo manual: SKU 2202007, 606042, 701042; puede haber más). Documentar el listado completo en `docs/reuniones/2026-07-12_costo_promedio_outliers.md` para la próxima reunión con Ricardo. Confirmar también si `cost_avg` cambia entre syncs sucesivos del mismo producto sin razón aparente (indicaría bug de cálculo en el ERP, no solo un dato viejo corrupto).

## Bloque F — Sync automático cada 15 min (implementa TASK-009, ver plan.md §6)

- [x] **TASK-014** Extraer la lógica de `POST /api/milenium/sync-inventario` a una función reutilizable `runInventorySync(db)` (en `src/lib/flex-crm.ts` o nuevo `src/lib/inventory-sync.ts`), reutilizada tanto por el route handler existente como por el cron nuevo.
- [x] **TASK-015** `instrumentation.ts` (Next.js 16, corre una vez al iniciar el servidor) + `node-cron`: programar `runInventorySync('all')` cada 15 minutos. Loggear cada corrida (éxito/error, duración, cantidad sincronizada) con `console.log` estructurado.
- [ ] **TASK-016** Prueba manual: levantar el servidor, confirmar en logs que el cron corre a los 15 min sin bloquear el arranque ni la UI; confirmar que el botón "Sincronizar" manual sigue funcionando igual.
