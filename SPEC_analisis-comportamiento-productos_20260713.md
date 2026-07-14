# SPEC: Pestaña "Comportamiento de productos" (módulo Inventario)
> Generado: 2026-07-13
> Proyecto: Fast Order (Pedidos Paisas)
> Handoff: Claude/Cowork → Antigravity
> Spec fuente (SDD): `.spec/analisis-comportamiento-productos/spec.md` · Constitución: `.spec/constitution.md`

---

## 1. CONSTITUTION (no negociable)

- **API solo por `src/lib/flex-crm.ts`.** Reusar `getInvoices`/`normalizeInvoice` ya existentes; no crear una segunda puerta ni `fetch` directo a la API.
- **Dos bases con `db_source`; idempotencia** por clave natural; **sync server-side** (no desde el navegador).
- **RLS** en toda tabla nueva; ventas/costos/márgenes son sensibles → acceso solo a administración (Art. 3).
- **Calidad (Art. 4):** TS estricto sin `any` nuevos en integración; el mapeo factura→`sales_lines` con tests usando la muestra real; errores con contexto, nunca `catch` silencioso.
- **NO romper** las pestañas **Catálogo** ni **Análisis** actuales, ni `inventory_master` ni su sync. Esta feature es **aditiva**.

## 2. SPECIFICATION (qué se construye)

Una **3ª pestaña "Comportamiento"** en `/inventario` que analiza **rotación/ventas**, **rentabilidad/márgenes** y **descuadres/mermas** de los productos, en vista **agregada** (ranking + gráficos) y **ficha por producto** (drill-down). Se alimenta de un **sync nuevo de ventas** del ERP (líneas de factura) hacia una tabla propia `sales_lines`.

**Incluye:** sync de ventas (backfill + incremental), tabla `sales_lines`, pestaña con agregados y ficha.
**Excluye (esta fase):** quiebres/reposición, pronóstico/ML, BD2 en ejecución (código listo para 2 bases pero corre BD1-only hasta credenciales de Ricardo), y cualquier cambio a la pestaña Análisis actual.

## 3. CLARIFICATIONS (decisiones tomadas)

- **Decisión:** dimensiones = rotación/ventas + rentabilidad/márgenes + descuadres/mermas. → **Razón:** es lo que el cliente pidió; quiebres/reposición queda fuera.
- **Decisión:** fuente = **sincronizar ventas** a `sales_lines`, no consultar la API en vivo. → **Razón:** volumen (~4.738 facturas/mes) y latencia (~13 s/mes) hacen inviable el on-the-fly.
- **Decisión:** formato = **agregado + ficha por producto**. → **Razón:** el dueño quiere el panorama y poder profundizar en un ítem.
- **Decisión:** reusar `getInvoices`/`normalizeInvoice` y el patrón de sync+cron del inventario. → **Razón:** una sola puerta a la API (Art. 2) y no reinventar.
- **Decisión:** excluir los SKUs con `cost_avg` corrupto conocidos (2202007, 701042, 606042) del cálculo de márgenes. → **Razón:** son errores del ERP ya documentados (ver Valorización).

## 4. PLAN (arquitectura y enfoque)

**Flujo de datos**
```
API Flex CRM (/crm/all/invoice, BD1/BD2)
  │ flex-crm.getInvoices(rango) → normalizeInvoice → líneas
  ▼ (server-side, backfill por lotes + incremental por cron)
sales_lines (Supabase, RLS admin)  ── índices (sku), (db_source,fecha), (fecha)
  ▼ consultas de agregación (SQL/RPC), cruce con inventory_master e inventory_counts
Pestaña "Comportamiento" (/inventario): agregado (Recharts + tablas) + ficha por producto
```

**Estructura de archivos**
- `supabase/migrations/0XX_sales_lines.sql` — **nuevo**: tabla + RLS + índices.
- `src/lib/flex-crm.ts` — **reusar** `getInvoices`/`normalizeInvoice` (no duplicar); si hace falta, un mapper `invoiceLinesToSalesRows()`.
- `src/app/api/milenium/sync-ventas/route.ts` — **nuevo**: backfill por lotes (rango configurable) + incremental; degrada BD2 sin credenciales; log con contexto.
- `src/instrumentation.ts` — **extender**: cron incremental de ventas (frecuencia menor que inventario, ej. cada hora o al cierre).
- `src/app/inventario/page.tsx` — **extender**: `activeTab` pasa a `'catalog' | 'analysis' | 'behavior'`.
- `src/components/inventory/BehaviorTab.tsx` — **nuevo**: vista agregada + ficha (Recharts).
- (opcional) RPCs/vistas SQL para las agregaciones pesadas.

**Puntos de integración (no romper)**
- `inventory_master` (stock/costo/clasificación) y `inventory_sessions`/`inventory_counts` (descuadres) se **leen**, no se modifican.
- La pestaña Análisis (`InventoryAnalysisTab`) y Catálogo (`UnifiedStockTable`) quedan igual; "Comportamiento" es una rama nueva del mismo layout.

## 5. TASKS (por fases)

### Fase A — Sync de ventas
- [ ] **A1 — Migración `sales_lines`.** Tabla con `db_source, tipodoc, numero, fecha, sku, descripcion, id_clasificacion, id_marca, id_bodega, id_vendedor, cantidad, precio, total, costo_unit, total_costo, margen, synced_at`; **RLS admin-only**; único `(db_source, tipodoc, numero, sku)`; índices `(sku)`, `(db_source, fecha)`, `(fecha)`. *Resultado:* migración idempotente aplicada.
- [ ] **A2 — Mapeo factura→`sales_lines`.** Sobre `normalizeInvoice`, transformar cada `item` a fila (`ID_ITEM→sku`, `CANTIDAD→cantidad`, `PRECIO→precio`, `COSTO_KARDEX→costo_unit`, `TOTAL→total`, calcular `margen`). Test con `scripts/validacion-pedidos-MUESTRA.json`. *Resultado:* mapper tipado + test verde.
- [ ] **A3 — Route handler `sync-ventas`.** Backfill por lotes (rango configurable, ej. últimos 3–6 meses en chunks de días/semanas) + incremental; upsert idempotente; degrada BD2 sin credenciales; errores con contexto. *Resultado:* `sales_lines` poblada sin bloquear al usuario.
- [ ] **A4 — Cron incremental.** En `instrumentation.ts`, programar el incremental de ventas (frecuencia menor que el de inventario). *Resultado:* ventas recientes se refrescan solas.

### Fase B — Pestaña "Comportamiento"
- [ ] **B1 — Tercera pestaña.** `activeTab` incluye `'behavior'` en `/inventario`, sin alterar Catálogo ni Análisis. *Resultado:* navegación de 3 pestañas.
- [ ] **B2 — Agregaciones.** Consultas/RPC para: más/menos vendidos, velocidad, **dead stock** (`system_stock>0` y 0 ventas), top/bottom margen y **márgenes negativos**; **excluir** SKUs de costo corrupto. *Resultado:* datos correctos y performantes.
- [ ] **B3 — Vista agregada.** Ranking + gráficos (Recharts) con filtros por período y clasificación. *Resultado:* panorama accionable.
- [ ] **B4 — Ficha por producto.** Buscar un SKU → ventas en el tiempo, stock (`system_stock`/`physical_stock`), costo, margen e historial de descuadres (de `inventory_counts`). *Resultado:* drill-down por ítem.
- [ ] **B5 — Seguridad + regresión.** RLS/permisos admin-only sobre ventas; verificar Catálogo, Análisis y el sync de inventario intactos; `npm run build` y `lint` limpios. *Resultado:* cero regresiones.

## 6. CONTEXTO PARA ANTIGRAVITY

### Keywords para el KM
- flex-crm getInvoices normalizeInvoice sales_lines
- sync ventas backfill incremental instrumentation cron
- inventario comportamiento rotacion margen dead stock
- cost_avg corrupto outliers valorizacion excluir
- inventory_master inventory_counts descuadres RLS

### Archivos relevantes
- `.spec/analisis-comportamiento-productos/spec.md` — spec SDD (fuente de verdad)
- `src/lib/flex-crm.ts` — `getInvoices`/`normalizeInvoice` a reusar
- `src/app/api/milenium/sync-inventario/route.ts` — patrón de sync a imitar
- `src/instrumentation.ts` — cron existente (inventario cada 15 min)
- `src/app/inventario/page.tsx` — `activeTab` (catalog/analysis → +behavior)
- `src/components/inventory/InventoryAnalysisTab.tsx`, `UnifiedStockTable.tsx` — pestañas actuales (no romper)
- `src/lib/inventory-mapper.ts` — columnas de `inventory_master`
- `scripts/validacion-pedidos-MUESTRA.json` — base de los tests del mapeo

### Próximo paso recomendado
Empezar por **A1** (migración `sales_lines`) y **A2** (mapeo + test). No tocar la UI hasta que el sync de ventas esté poblando datos reales de BD1.
