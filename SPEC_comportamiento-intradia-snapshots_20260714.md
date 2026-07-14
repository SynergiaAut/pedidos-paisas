# SPEC: Comportamiento intradía por snapshots (BD1 / BD2 / General)
> Generado: 2026-07-14
> Proyecto: Fast Order (Pedidos Paisas)
> Handoff: Claude/Cowork → Antigravity
> Spec fuente relacionada: `.spec/analisis-comportamiento-productos/spec.md`

---

## 0. CONTEXTO YA CONSTRUIDO (leer primero — para no re-descubrir ni romper)

Todo esto ya existe en el repo (trabajado en sesiones previas Claude/Cowork + Antigravity). Esta feature es **aditiva** sobre ello:

- **Captura de pedidos por API** (`src/app/pedidos/nuevo-api/`, `src/app/actions/pedidos-capture.ts`, migración `019_pedido_sessions_invoices.sql`): detección de facturas del vendedor de Pedidos, consolidación BD1+BD2, ticket. Ya probado.
- **`src/lib/flex-crm.ts`**: única puerta a la API. Tiene `getInvoices`/`normalizeInvoice` (facturas con líneas reales: `ID_ITEM`, `CANTIDAD`, `PRECIO`, `COSTO_KARDEX`). **No crear otra puerta a la API.**
- **Sync de ventas (ya construido):** `src/lib/sales-sync.ts`, `src/app/api/milenium/sync-ventas/route.ts`, `src/app/actions/sales-analytics.ts`, tabla `sales_lines` (migración `021_sales_lines.sql`).
- **Pestaña "Comportamiento":** `src/components/inventory/BehaviorTab.tsx` — ya tiene gráfico de tendencia por `fecha` (AreaChart de ventas + LineChart de margen), selector de periodo (7/30/90 días), filtro por clasificación y ficha por producto. **Excluye SKUs de costo corrupto** (`['2202007','701042','606042']`). Hoy el gráfico va **agregado (una sola serie), sin separar BD1/BD2 ni intradía.**
- **KPI "Unidades en Stock"** (`get_stock_units`, migración `023_stock_units_kpi.sql`) + `getInventoryStats` en `src/app/actions/inventory.ts`.
- **Sync de inventario** cada 15 min vía `src/instrumentation.ts` (node-cron) → `src/lib/inventory-sync.ts` (nunca escribe `physical_stock`).
- **BD2 ya habilitada** (mismas credenciales base que BD1). El sistema opera con 2 bases: BD1 (2.145) y BD2 (2.572).
- **Migraciones pendientes de aplicar en Supabase** (si aún no): `021_sales_lines`, `022_fix_physical_stock_default`, `023_stock_units_kpi`. (`020` ya aplicada.)
- **Deudas conocidas:** hubo **deriva de esquema** (columnas del CRM y default de `physical_stock` diferían de las migraciones → por eso `020` y `022`). Pendiente auditar/versionar el esquema completo. Y **git a veces queda enredado** (migraciones como `D` + `??`): hacer `git add -A` antes de commitear y **no duplicar números de migración** (ya pasó con `020` y `021`).

**Dato clave que motiva esta feature:** las facturas del ERP **no traen hora** (`FECHA` es fecha; `FECHA_DESPACHO` es la fecha-cero de Firebird). Por eso el análisis intradía **no** puede salir de la factura — se resuelve con snapshots propios (abajo).

---

## 1. CONSTITUTION (aplicable)

- API solo por `flex-crm.ts`; `db_source` en todo dato; **idempotencia**; **sync server-side**; **RLS admin** sobre ventas/costos (Art. 2/3).
- **No golpear el túnel de más:** el pull de cada snapshot debe ir **acotado al día de hoy** (rango pequeño) y **degradar** (no lanzar) si BD2 o el túnel fallan (Art. 4).
- **No romper** el gráfico de tendencia diaria actual, la ficha por producto, el KPI, ni los syncs existentes. Aditivo.

## 2. SPECIFICATION (qué se construye)

Capturar **snapshots periódicos** de las ventas **agregadas del día por base** (con **nuestra** marca de tiempo), y usarlos para un **gráfico intradía interactivo** en la pestaña Comportamiento, con series **BD1 / BD2 / General**.

**Incluye:** tabla `sales_snapshots`, captura en el tick del sync (**cada 5 min**), acciones de lectura, y la vista intradía en `BehaviorTab`.
**Excluye:** intradía **por producto** (queda diario, desde `sales_lines`); **reconstrucción histórica** intradía (los snapshots solo acumulan **hacia adelante**); intradía real por transacción (la resolución = la frecuencia del sync).

## 3. CLARIFICATIONS (decisiones tomadas)

- **Decisión:** generar eje de tiempo propio con snapshots. → **Razón:** la API no da la hora de la factura; es la única forma de tener intradía.
- **Decisión:** frecuencia **cada 5 minutos** (configurable; opcional limitar a horario de operación). → **Razón:** curva fluida sin saturar el túnel; el pull del día es liviano.
- **Decisión:** guardar **agregados por BD** (no por SKU). → **Razón:** por-SKU intradía explotaría el almacenamiento; el detalle por producto se mantiene diario.
- **Decisión:** "General" = suma de BD1+BD2 (se calcula al leer o se guarda como fila `db_source='ALL'`). → **Razón:** simplicidad.
- **Decisión:** contemplar **corte de día** (el acumulado se reinicia a medianoche) y **anulaciones** (la curva puede bajar). → **Razón:** evitar curvas erróneas.
- **Decisión:** excluir los SKUs de costo corrupto del margen (igual que en Comportamiento/Valorización).

## 4. PLAN (arquitectura y enfoque)

**Flujo**
```
Cron cada 5 min (instrumentation.ts)
  │ 1) refresca sales_lines de HOY (rango = hoy) por BD1/BD2 (reusa sales-sync)
  │ 2) calcula agregado de HOY por BD (suma unidades/venta/costo/margen, excluye SKUs corruptos)
  ▼ inserta 1 fila por BD en sales_snapshots (captured_at = ahora, dia = hoy)
sales_snapshots (Supabase, RLS admin)
  ▼ sales-analytics: getIntradaySnapshots(dia) / getSnapshotSeries(periodo)
BehaviorTab → vista "Intradía": toggle BD1/BD2/General, acumulado vs actividad-por-franja (delta), selector de día
```

**Datos**
- Tabla `sales_snapshots`: `id`, `captured_at` timestamptz (default now), `db_source` text ('01'|'02'|'ALL'), `dia` date, `unidades` numeric, `venta` numeric, `costo` numeric, `margen` numeric. Índices: `(dia, db_source, captured_at)`. **RLS admin-only.**
- "Actividad por franja" = `unidades[t] − unidades[t-1]` (delta entre snapshots consecutivos del mismo día/BD), calculada al leer.

**Frecuencia:** `*/5 * * * *` en `instrumentation.ts` (nuevo cron, separado del de inventario de 15 min). El pull de hoy debe ser corto y con timeout; si falla una base, se omite ese snapshot para esa base con log, sin romper.

**Reúso:** `sales-sync.ts` para el refresco de hoy, `sales-analytics.ts` para las consultas, Recharts (ya usado en `BehaviorTab`).

## 5. TASKS

- [ ] **S1 — Migración `sales_snapshots`.** Tabla + índices + **RLS admin-only**. Usar el **siguiente número libre** de migración (verificar: hoy el último es `023` → usar `024`; confirmar que no haya colisión). *Resultado:* tabla creada, idempotente.
- [ ] **S2 — Agregado de hoy por BD.** Función/consulta que suma unidades/venta/costo/margen de `sales_lines` con `fecha = hoy`, por `db_source`, **excluyendo** los SKUs de costo corrupto. *Resultado:* números de hoy correctos por base.
- [ ] **S3 — Captura de snapshot + cron 5 min.** En `instrumentation.ts`, nuevo cron `*/5 * * * *` que (1) refresca `sales_lines` de hoy y (2) inserta una fila en `sales_snapshots` por BD (y opcional `ALL`). Timeout corto; degrada si BD2/túnel fallan; log con contexto. *Resultado:* snapshots acumulando cada 5 min.
- [ ] **S4 — Lecturas.** En `sales-analytics.ts`: `getIntradaySnapshots(dia)` (serie del día por BD + General, con acumulado y delta) y `getSnapshotSeries(periodo)` si se quiere multi-día. *Resultado:* datos listos para el gráfico.
- [ ] **S5 — Gráfico intradía.** En `BehaviorTab`, nueva vista/sección "Intradía": líneas/áreas **BD1 / BD2 / General**, toggle **acumulado vs actividad-por-franja**, selector de día, tooltip. Interactivo (Recharts). *Resultado:* el gráfico pedido.
- [ ] **S6 — Robustez + regresión.** Manejar corte de día (reinicio del acumulado) y bajadas por anulación; **no romper** el gráfico de tendencia diaria, la ficha por producto ni los syncs; `npm run build` y `lint` limpios. *Resultado:* cero regresiones.

## 6. CONTEXTO PARA ANTIGRAVITY

### Keywords para el KM
- sales_snapshots intradia comportamiento
- sales-sync sales-analytics BehaviorTab recharts
- instrumentation cron 5 minutos snapshot
- db_source BD1 BD2 general acumulado delta
- facturas sin hora fecha-cero firebird

### Archivos relevantes
- `.spec/analisis-comportamiento-productos/spec.md` — spec base de Comportamiento
- `src/lib/sales-sync.ts`, `src/app/api/milenium/sync-ventas/route.ts` — sync de ventas existente
- `src/app/actions/sales-analytics.ts` — consultas de Comportamiento (agregar las de snapshots)
- `src/components/inventory/BehaviorTab.tsx` — pestaña (agregar la vista intradía)
- `src/instrumentation.ts` — cron (agregar el de 5 min)
- `src/lib/flex-crm.ts` — `getInvoices`/`normalizeInvoice` (no duplicar)
- `supabase/migrations/` — último número aplicado; usar el siguiente libre para `sales_snapshots`

### Próximo paso recomendado
Empezar por **S1** (tabla) y **S2** (agregado de hoy por BD). Validar que S3 inserta snapshots correctos durante unas horas ANTES de construir el gráfico (S5), para tener datos reales que graficar.

### Recordatorio operativo (no de esta feature, pero pendiente)
Aplicar en Supabase (si falta): `021_sales_lines`, `022_fix_physical_stock_default`, `023_stock_units_kpi`. Y antes del próximo commit: `git add -A` para reconciliar el índice, sin duplicar números de migración.
