# Tasks: Dashboard de consolidados de sesiones de inventario (referencia: plan.md)

> Handoff: Claude/Cowork → Antigravity. Sin dependencias de Ricardo/BD2 — se puede ejecutar completa ya.
> Antes de empezar: revisar con `get_advisors` (MCP Supabase) que la migración 016 no rompa RLS existente sobre `inventory_master`/`inventory_counts`/`inventory_sessions`.

## Bloque A — Base de datos

- [x] **TASK-D01** Migración `supabase/migrations/016_physical_stock_on_count.sql`: agregar `last_counted_at timestamptz` a `inventory_master`; modificar `submit_mobile_count` para que además de insertar en `inventory_counts` actualice `inventory_master.physical_stock`/`last_counted_at` del ítem contado (sin tocar `system_stock`); crear `create or replace view public.inventory_session_summary` (ver plan.md §2). Verifica: `apply_migration` sin error; un `submit_mobile_count` de prueba deja `physical_stock` actualizado en `inventory_master`; `select * from inventory_session_summary limit 5` corre sin error.
- [x] **TASK-D02** Confirmar (o crear si falta) índice sobre `inventory_counts(session_id)` y `inventory_counts(item_master_id)` en la misma migración — necesarios para que las agregaciones de sesión y de ranking no degraden con el tiempo.

## Bloque B — Backend (Server Actions)

- [x] **TASK-D03** `src/app/actions/inventory-analytics.ts`: `getSessionsSummary()`, `getDiscrepancyTrend()`, `getCoverage()` (autenticadas, mismo patrón que `inventory.ts`). Verifica: cada función devuelve datos reales contra sesiones ya existentes en el ambiente de pruebas.
- [x] **TASK-D04** Misma archivo: `getProblemProductsRanking(limit = 10)` — agregación por `item_master_id` con `having count(distinct session_id) filter (...) > 1` (ver plan.md §3). Verifica: con datos de prueba de al menos 2 sesiones con descuadre repetido en el mismo producto, el producto aparece en el ranking; si no hay ningún caso así, la función devuelve arreglo vacío sin error.
- [x] **TASK-D05** Modificar el server action del wizard desktop (en `src/app/actions/inventory.ts`, el que inserta conteos síncronos) para que también actualice `inventory_master.physical_stock`/`last_counted_at` del ítem, igual que el RPC móvil (TASK-D01). Verifica: un conteo hecho desde "Contar en este computador" deja el mismo rastro en `inventory_master` que uno hecho por link móvil.

## Bloque C — Frontend: pestaña Análisis

- [x] **TASK-D06** `src/app/inventario/page.tsx`: agregar tabs simples "Catálogo" / "Análisis" (sin librería nueva, estado local `activeTab`).
- [x] **TASK-D07** `src/components/inventory/InventoryAnalysisTab.tsx`: tarjeta de cobertura (`getCoverage()`) con barra de progreso.
- [x] **TASK-D08** Mismo componente: gráfico de tendencia con `recharts` `LineChart` sobre `getDiscrepancyTrend()` (eje X = sesiones por fecha de cierre).
- [x] **TASK-D09** Mismo componente: tabla de historial de sesiones (`getSessionsSummary()`) — nombre, modo (ícono), fecha, estado, ítems contados, descuadres, valor estimado en COP.
- [x] **TASK-D10** Mismo componente: tabla de ranking de productos problemáticos (`getProblemProductsRanking()`) con estado vacío claro si no hay datos suficientes (ver plan.md, riesgo #3).

## Bloque D — Frontend: "ya contados" primero

- [x] **TASK-D11** `src/components/inventory/UnifiedStockTable.tsx`: cambiar el orden de la consulta a `last_counted_at desc nullsFirst:false` + `description` como desempate; agregar chip/indicador "Contado hace X" (date-fns) cuando `last_counted_at` no sea null. Verifica: tras contar un ítem, sube al principio de la tabla en la siguiente carga/realtime.
- [x] **TASK-D12** `src/components/inventory/CyclicCountWizard.tsx` (Paso 2, modo desktop): ordenar en el cliente los ítems ya guardados (`counts[item.id]` presente) al principio de la lista visible.

## Bloque E — Fix menor incluido (hallazgo de esta sesión)

- [x] **TASK-D13** `src/app/inventario/page.tsx`: cambiar `onComplete={() => setShowWizard(false)}` por `onComplete={() => { setShowWizard(false); loadStats(); }}` para que "Conteos Pendientes" se actualice al cerrar cualquier conteo (desktop o móvil). Verifica: cerrar una sesión de conteo baja el contador de "Conteos Pendientes" sin necesidad de recargar la página.

## Bloque F — QA y cierre

- [x] **TASK-D14** Prueba manual E2E: completar 2-3 sesiones de conteo de prueba (mezclando desktop y móvil, con al menos un producto repetido con descuadre en 2 sesiones distintas) y verificar que la pestaña Análisis muestra cobertura, tendencia, historial y ranking coherentes con lo capturado.
- [x] **TASK-D15** Actualizar `docs/modulos/inventario.md` con la nueva pestaña de Análisis y la semántica final de `physical_stock`/`last_counted_at`; actualizar "Estado actual" de `CLAUDE.md`.

## Bloque G — Valorización y pérdidas (ver plan.md §9)

- [x] **TASK-D16** `src/app/actions/inventory-analytics.ts`: nueva función `getInventoryValuation()` — `totalInventoryValue` (`sum(system_stock*cost_avg)` todo `inventory_master` no-servicio), `countedInventoryValue` (mismo cálculo solo con `physical_stock is not null`), `totalDiscrepancyValue` (suma de `discrepancy_value` de `inventory_session_summary` en sesiones completadas), `lossPercentage` (`totalDiscrepancyValue / countedInventoryValue`, `0` si `countedInventoryValue` es `0` para evitar división por cero). Verifica: con datos de prueba ya sembrados en la sesión anterior, los 4 valores son coherentes y no truena con división por cero si aún no hay nada contado.
- [x] **TASK-D17** `InventoryAnalysisTab.tsx`: nueva sección "Valorización y Pérdidas" con tarjetas para los 4 valores de TASK-D16, formato moneda COP (`Intl.NumberFormat('es-CO', {style:'currency', currency:'COP'})` o similar ya usado en el proyecto).
- [x] **TASK-D18** Mismo componente: aviso visible (no tooltip, no colapsado) inmediatamente debajo de esa sección con el texto exacto de plan.md §9.2 ("Estos valores son estimados... no constituyen un estado financiero oficial...").
- [x] **TASK-D19** Prueba manual: confirmar que los 4 valores nuevos coinciden con un cálculo manual rápido sobre 2-3 productos de prueba (system_stock × cost_avg conocido) y que el aviso es claramente visible sin necesidad de hover/click.

## Bloque H — Confiabilidad de datos de valorización (ver plan.md §10)

- [x] **TASK-D20** Limpieza: `delete from inventory_counts where session_id in (select id from inventory_sessions where name in ('Conteo Móvil Pasillo A - Dulces', 'Conteo Semanal Confitería - Semana 27'))`, luego `delete from inventory_sessions where name in (...)`. Verificar antes con un `select` que son exactly esas 2 y no hay ninguna sesión real con nombre parecido. Revisar si algún ítem de `inventory_master` quedó con `physical_stock`/`last_counted_at` puesto únicamente por estas sesiones (sin ningún otro conteo real posterior) y en ese caso revertir a `null`.
- [x] **TASK-D21** `src/app/actions/inventory-analytics.ts`: agregar constante `SUSPICIOUS_COST_THRESHOLD = 5_000_000` (COP). Modificar `getInventoryValuation()` para excluir de `totalInventoryValue`/`countedInventoryValue` cualquier fila de `inventory_master` (no-servicio) con `cost_avg > SUSPICIOUS_COST_THRESHOLD`, y devolver `suspiciousCostItems: {sku, description, cost_avg}[]` con esas filas excluidas.
- [x] **TASK-D22** Confirmar puntualmente el caso SKU `2202007` (LATON SIXPACK CERVEZA CLUB COLOMBIA, `cost_avg` ≈ $50.172.233.299.062,07 COP): debe aparecer en `suspiciousCostItems` y quedar excluido de los totales. No editar `cost_avg` en la tabla (se sobreescribe en cada sync con Milenium) — solo excluir del cálculo. Documentar el hallazgo en `docs/reuniones/` o pendiente para la próxima reunión con Ricardo (posible error de escala/decimal en el dato de origen del ERP).
- [x] **TASK-D23** Mismo archivo: agregar `zeroCostCount`/`zeroCostPercentage` (productos no-servicio con `cost_avg = 0`) y `dbSourcesIncluded: string[]` (distinct `db_source` de `inventory_master`) al retorno de `getInventoryValuation()`.
- [x] **TASK-D24** `InventoryAnalysisTab.tsx`: (a) alerta visible listando los productos de `suspiciousCostItems` excluidos por costo fuera de rango; (b) texto secundario con `zeroCostPercentage` ("X% del catálogo no tiene costo registrado..."); (c) segunda línea del aviso obligatorio armada dinámicamente a partir de `dbSourcesIncluded` (ej. "Cifras calculadas solo sobre: Empresa 1 (GRANESLOSPAISAS)" si el array es `['01']`).
- [x] **TASK-D25** Prueba manual: recalcular a mano el total esperado tras excluir el SKU `2202007` y las 2 sesiones de prueba, y confirmar que las tarjetas del dashboard coinciden. Confirmar que la alerta de costos sospechosos y el % de costo faltante son visibles sin hover/click.

## Bloque I — Usabilidad del dashboard tras uso real (ver plan.md §11)

- [x] **TASK-D26** `getSessionsSummary()`: incluir `category_filter`. `InventoryAnalysisTab.tsx`: columna "Categoría" en la tabla de Historial de Sesiones (badge, "Todas" si es `null`).
- [x] **TASK-D27** Nueva función `getSessionDetail(sessionId)` en `inventory-analytics.ts` (join `inventory_counts`+`inventory_master` de esa sesión: sku, description, system_stock, counted_quantity, expected_stock, diferencia, valor). Filas de la tabla de historial pasan a ser clickeables y abren modal/panel con el detalle.
- [x] **TASK-D28** `getPendingSession()` (o extender `getInventoryStats()`) devolviendo id/token de la sesión pendiente. La `StatsCard` "Conteos Pendientes" en `src/app/inventario/page.tsx` es clickeable cuando `pendingSessions > 0` y abre/reanuda esa sesión.
- [x] **TASK-D29** Botón "Historial" (`src/app/inventario/page.tsx` ~línea 111) recibe `onClick`: cambia a pestaña "Análisis y Consolidados" y hace scroll a la sección de Historial de Sesiones.
- [x] **TASK-D30** Ajustar el grid/tamaño de la tarjeta "Valorización y Pérdidas" para que no ocupe más espacio del necesario respecto a las demás tarjetas del dashboard (alturas consistentes).
- [x] **TASK-D31** Reducir el padding vertical de las 4 `StatsCard` superiores de `/inventario` para bajar su altura total.
- [x] **TASK-D32** Prueba manual: click en una fila del historial abre el detalle correcto; click en "Conteos Pendientes" (con al menos 1 sesión pendiente activa) abre esa sesión; botón "Historial" navega y hace scroll; las tarjetas se ven visiblemente más compactas sin romper el layout responsive.

## Bloque J — Reconciliación de descuadre al cierre de sesión (ver plan.md §12)

- [x] **TASK-D33** Migración `supabase/migrations/018_reconciliacion_cierre.sql`: agregar `system_stock_at_close numeric null` y `reconciliation_note text null` a `inventory_counts`.
- [x] **TASK-D34** Modificar `finish_mobile_count_session` (migración 017) y el cierre del wizard desktop: por cada `inventory_counts` de la sesión, consultar `getOneProduct(sku)` (ya existe en `flex-crm.ts`) para el `existencia_total` fresco. Si difiere de `expected_stock`, guardar `system_stock_at_close` y `reconciliation_note` con el texto de plan.md §12.2. Tolerante a fallos parciales por SKU (no bloquea el cierre de la sesión si Milenium no responde para alguno).
- [x] **TASK-D35** `inventory_session_summary`: `discrepancy_value` usa `coalesce(system_stock_at_close, expected_stock)` en el cálculo.
- [x] **TASK-D36** Modal de detalle de sesión (Bloque I): badge "Reconciliado" en ítems con `reconciliation_note`, mostrando bruto tachado + neto, y la nota al hover/click. Aviso general (una vez, no por ítem) en la sección de Valorización explicando la reconciliación automática.
- [x] **TASK-D37** Prueba manual: simular una venta (reducir manualmente `existencia`/stock de un SKU contado, vía sync o dato de prueba controlado) entre el conteo de un ítem y el cierre de la sesión; confirmar que el cierre detecta el cambio, guarda la nota, y el descuadre mostrado usa el valor reconciliado en vez del bruto.
