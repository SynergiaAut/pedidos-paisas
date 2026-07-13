# Plan Técnico: Dashboard de consolidados de sesiones de inventario

**Referencia:** `spec.md`. Sin dependencias de Ricardo/BD2. Se apoya en tablas ya existentes (`inventory_sessions`, `inventory_counts`, `inventory_master`) — no requiere tablas nuevas, solo una migración de ajuste + vistas/consultas de agregación.

## 1. Migración: `physical_stock` se actualiza en cada conteo válido

**Archivo nuevo:** `supabase/migrations/016_physical_stock_on_count.sql`

- Agregar columna `last_counted_at timestamptz` a `inventory_master` (si no existe).
- Modificar `submit_mobile_count` (RPC, `create or replace function`) para que, además de insertar en `inventory_counts`, también haga:
  ```sql
  update public.inventory_master
     set physical_stock = p_counted_qty,
         last_counted_at = now()
   where id = p_item_id;
  ```
  dentro de la misma transacción (la función ya es `security definer`, así que puede escribir en `inventory_master` aunque el rol `anon` no tenga grant directo sobre la tabla — el mismo patrón de seguridad que ya usa el resto del RPC).
- El flujo desktop (`CyclicCountWizard`, conteo síncrono sin link) debe recibir el mismo tratamiento: su inserción a `inventory_counts` (server action, usuario autenticado) debe ir acompañada de la misma actualización a `inventory_master` — ver sección 3.
- **No se toca `system_stock` en ningún punto de este spec ni de conteo-movil** — sigue siendo exclusivo del sync con Milenium.

## 2. Vista SQL de agregación por sesión

**Misma migración 016**, para no tener que mantener la lógica de agregación duplicada en cada server action:

```sql
create or replace view public.inventory_session_summary as
select
    s.id as session_id,
    s.name,
    s.mode,
    s.status,
    s.started_at,
    s.completed_at,
    count(c.id) as items_counted,
    count(c.id) filter (where c.counted_quantity <> c.expected_stock) as discrepancies,
    coalesce(sum(abs(c.counted_quantity - c.expected_stock) * coalesce(im.cost_avg, 0)), 0) as discrepancy_value
from public.inventory_sessions s
left join public.inventory_counts c on c.session_id = s.id
left join public.inventory_master im on im.id = c.item_master_id
group by s.id;
```

La vista hereda RLS de las tablas base (Postgres respeta las policies de `inventory_sessions`/`inventory_counts` al consultar la vista si se crea sin `security definer` — se deja como vista normal, no `security barrier` especial, ya que ambas tablas ya están cerradas a `authenticated`).

## 3. Backend — Server Actions

**Archivo nuevo:** `src/app/actions/inventory-analytics.ts` (todas autenticadas, mismo patrón que `inventory.ts`):

- `getSessionsSummary()`: `select * from inventory_session_summary order by started_at desc`.
- `getDiscrepancyTrend()`: mismo origen que arriba, pero solo `{session_id, name, completed_at, discrepancies, discrepancy_value}` ordenado por `completed_at` para alimentar el gráfico de línea.
- `getProblemProductsRanking(limit = 10)`: agrega `inventory_counts` por `item_master_id` contando `count(distinct session_id) filter (where counted_quantity <> expected_stock)` como `sesiones_con_descuadre`, y `sum(abs(counted_quantity - expected_stock) * cost_avg)` como `magnitud_acumulada`; filtra `having count(distinct session_id) filter (...) > 1`; ordena por `sesiones_con_descuadre desc, magnitud_acumulada desc`; hace join con `inventory_master` para traer `sku`/`description`.
- `getCoverage()`: `count(*) filter (where physical_stock is not null) / count(*)` sobre `inventory_master where is_service = false`, devuelve `{ counted, total, percentage }`.

**Modifica:** `src/app/actions/inventory.ts` — la ruta desktop que hoy inserta en `inventory_counts` desde el wizard debe, en el mismo server action, actualizar también `inventory_master.physical_stock`/`last_counted_at` para el ítem contado (mismo criterio de la sección 1, pero desde el server action autenticado en vez del RPC anónimo).

## 4. Frontend — Nueva pestaña "Análisis" en `/inventario`

**Archivo nuevo:** `src/components/inventory/InventoryAnalysisTab.tsx`, montado como una pestaña adicional junto al Catálogo Unificado en `src/app/inventario/page.tsx` (tabs simples: "Catálogo" / "Análisis").

Contenido, de arriba hacia abajo:
1. **Tarjeta de cobertura**: `getCoverage()` — barra de progreso + "X de Y productos contados alguna vez (Z%)".
2. **Gráfico de tendencia** (recharts `LineChart`, ya en el stack): `getDiscrepancyTrend()` — eje X = sesiones ordenadas por fecha de cierre, dos líneas: `discrepancies` (cantidad) y opcionalmente `discrepancy_value` en un segundo eje Y.
3. **Tabla de historial de sesiones**: `getSessionsSummary()` — columnas nombre, modo (ícono desktop/móvil), fecha, estado, ítems contados, descuadres, valor estimado.
4. **Tabla de ranking de productos problemáticos**: `getProblemProductsRanking()` — sku, descripción, # sesiones con descuadre, magnitud acumulada, con formato de moneda COP.

## 5. Frontend — "ya contados" primero, en las dos pantallas acordadas

### 5.1 `UnifiedStockTable.tsx` (Catálogo Unificado general)
- Cambiar el `.order('description')` de la consulta a `inventory_master` por: `order('last_counted_at', { ascending: false, nullsFirst: false }).order('description')` — Postgres/PostgREST soporta `nullsFirst: false` para que los `null` (nunca contados) queden al final y los contados más recientes queden arriba.
- Agregar columna/indicador visual: si `last_counted_at` no es null, mostrar chip pequeño "Contado hace X" (usar `date-fns`, ya está en el stack) con tooltip o texto secundario indicando el nombre de la sesión (requiere traer también `session_id`/nombre de la última sesión que contó ese ítem — más simple: solo mostrar el tiempo relativo de `last_counted_at`, sin nombre de sesión, para no complicar la consulta con un join adicional en la tabla general; el detalle por sesión ya vive en la pestaña Análisis).

### 5.2 Vista de sesión activa (wizard desktop y resumen del conteo móvil en el admin)
- `CyclicCountWizard.tsx` (Paso 2, modo desktop): dentro de la lista de ítems de la sesión en curso, ordenar los que ya tienen `counts[item.id]` guardado al principio (sort en el cliente sobre el array ya cargado, sin nueva consulta — es la misma sesión, mismos ítems).
- Progreso del conteo móvil (Paso 2B del admin): si se muestra algún detalle de ítems (más allá de la barra de progreso), aplicar el mismo criterio; si solo se muestra el conteo agregado, no aplica cambio adicional aquí.

## 6. Fix menor incluido en este mismo bloque: stats "Conteos Pendientes" desactualizadas

Hallazgo de esta sesión (no requiere spec propio, es un bug de refresco de UI): `src/app/inventario/page.tsx`, el modal del wizard hace `onComplete={() => setShowWizard(false)}` sin volver a pedir `getInventoryStats()`. Cambiar a `onComplete={() => { setShowWizard(false); loadStats(); }}` para que "Conteos Pendientes" refleje el cierre inmediato de la sesión.

## Riesgos

1. **Doble escritura (RPC anónimo + server action autenticado) a `inventory_master.physical_stock`**: si dos conteos (uno desktop, uno móvil) del mismo ítem ocurren casi al mismo tiempo, gana el último `update` en llegar — aceptable, mismo criterio que ya se documentó para conteos duplicados en `conteo-movil/spec.md` (Clarification #2): el último valor es el vigente, la revisión de conflictos queda para el admin vía la pestaña Análisis.
2. **Vista `inventory_session_summary` sin índice en `inventory_counts.session_id`**: verificar que exista índice (probablemente ya existe por ser FK); si no, agregarlo en la misma migración 016 para que el `group by` no sea lento a medida que crecen las sesiones.
3. **Ranking de productos problemáticos puede quedar vacío al principio** (requiere ≥2 sesiones con descuadre del mismo producto) — mostrar estado vacío claro ("Aún no hay suficientes sesiones para detectar patrones") en vez de una tabla en blanco sin contexto.

## Dependencias

Migración 016 debe aplicarse antes de desplegar las nuevas rutas/actions. No requiere paquetes npm nuevos (recharts y date-fns ya están en `package.json`).

## 9. Addendum (2026-07-12, segunda sesión de prueba real): valorización y pérdidas en el dashboard

Pedido explícito de Camilo/Johnathan: ver el costo estimado en juego, no solo cantidades. Esto adelanta parte de la Fase D del roadmap ("Valorización del inventario") sin depender de BD2, porque `cost_avg` ya viene con BD1.

### 9.1 Métricas nuevas

- **Costo del inventario que se está inventariando**: `sum(system_stock * cost_avg)` de los ítems dentro del alcance de la sesión activa/seleccionada (mismo `category_filter` que usa esa sesión).
- **Costo total del inventario** (valorización general): `sum(system_stock * cost_avg)` sobre todo `inventory_master where is_service = false` — el número que se ve en el roadmap como "el que todo dueño quiere ver al cierre".
- **Costo total de descuadres**: suma de `discrepancy_value` (ya definido en `inventory_session_summary`, sección 2 de este plan) a través de todas las sesiones cerradas.
- **Porcentaje de pérdidas**: `costo_total_descuadres / valor_contado_total`, **no** contra el valor de todo el catálogo — dividir contra el catálogo completo diluye artificialmente el porcentaje con ítems que nunca se han contado y de los que no se sabe si están bien o mal. `valor_contado_total` = `sum(system_stock * cost_avg)` solo de los ítems con `physical_stock is not null` (ya contados al menos una vez).

### 9.2 Aviso obligatorio, visible junto a estas cifras

> "Estos valores son estimados a partir de costos promedio y conteos físicos operativos — **no constituyen un estado financiero oficial**. Para cifras contables consulta el ERP Milenium."

Debe mostrarse siempre visible junto a las tarjetas de costo, no en un tooltip escondido — el riesgo de que alguien tome estos números como cifra contable oficial es real y hay que evitarlo desde el diseño.

### 9.3 Backend

Nueva función en `src/app/actions/inventory-analytics.ts`: `getInventoryValuation()` → `{ totalInventoryValue, countedInventoryValue, totalDiscrepancyValue, lossPercentage }`. Todo el cálculo server-side (agregación SQL), nunca trayendo el catálogo completo al cliente para sumarlo ahí.

### 9.4 Frontend

`InventoryAnalysisTab.tsx`: nueva sección "Valorización y Pérdidas" con 3-4 tarjetas (valor total del inventario, valor contado, costo total de descuadres, % de pérdidas) + el aviso del punto 9.2 inmediatamente debajo, en texto visible (no oculto), formato moneda COP.

Ver tareas concretas en `tasks.md` Bloque G (TASK-D16 a TASK-D19).

## 10. Addendum (2026-07-12): confiabilidad de datos de valorización

Origen: Johnathan cuestionó las cifras del Bloque G tras verlas en vivo. Investigación (ver `spec.md` addendum) confirmó 4 problemas reales, todos de **calidad de datos**, no de lógica SQL — la consulta de `getInventoryValuation()`/`inventory_valuation_summary` está correctamente escrita.

### 10.1 Limpieza de datos de prueba

Borrar de la base de datos las 2 sesiones sembradas durante el desarrollo (`Conteo Móvil Pasillo A - Dulces`, `Conteo Semanal Confitería - Semana 27`) y sus filas asociadas en `inventory_counts` (`delete from inventory_counts where session_id in (...)` antes de `delete from inventory_sessions where id in (...)`, por la FK). Verificar que no queden `physical_stock`/`last_counted_at` en `inventory_master` que solo se hayan fijado por estas sesiones de prueba y ningún conteo real — si algún ítem solo fue tocado por una sesión de prueba, revertir su `physical_stock`/`last_counted_at` a `null` para no mostrar falsa cobertura.

### 10.2 Blindaje contra outliers en la valorización

**No editar directamente `cost_avg` de `inventory_master`** — ese campo se sobreescribe en cada sync con Milenium (es el mismo patrón de "no tocar el dato de origen" ya establecido para `system_stock`); corregirlo a mano se perdería en el próximo sync y además hay que confirmar con Ricardo qué pasó en el ERP.

En su lugar, definir un umbral de sospecha explícito y separar el cálculo:
- Constante `SUSPICIOUS_COST_THRESHOLD` (proponer $5.000.000 COP por unidad — muy por encima del ítem más caro plausible de un granero de barrio; ajustable sin redeploy si se vuelve una `app_setting` más adelante, pero para este MVP basta una constante en código).
- `inventory_valuation_summary` (o el server action `getInventoryValuation()`) debe **excluir** de `total_inventory_value`/`counted_inventory_value` cualquier fila con `cost_avg > SUSPICIOUS_COST_THRESHOLD`, y en su lugar devolver un campo adicional `{ suspiciousCostCount, suspiciousCostItems: [{sku, description, cost_avg}] }` para mostrarlo aparte.
- `InventoryAnalysisTab.tsx`: nueva alerta visible (no oculta) tipo "⚠ N producto(s) con costo unitario fuera de rango excluido(s) de estas cifras — requieren revisión con Milenium" listando sku/descripción; nunca dejar que un outlier así distorsione el total en silencio.

### 10.3 Cobertura de costo (productos en $0)

`getInventoryValuation()` también debe devolver `zeroCostCount` (productos con `cost_avg = 0`, excluyendo servicios) y su `zeroCostPercentage`. Mostrar como texto secundario junto a las tarjetas: "X% del catálogo no tiene costo promedio registrado en Milenium — estos productos no aportan a la valorización." No se excluyen del catálogo ni de la cobertura de conteo (eso es una métrica distinta, ya cubierta por `getCoverage()`), solo se aclara su efecto en las cifras de dinero.

### 10.4 Disclosure de alcance BD1-only

Mientras `db_source = '02'` (BD2) tenga 0 filas en `inventory_master`, el aviso obligatorio de §9.2 se extiende: agregar una segunda línea fija (no condicional a que aparezca BD2 — así no hay que recordar quitarla, se quita cuando se implemente la detección automática) tipo: "Cifras calculadas solo sobre Empresa 1 (GRANESLOSPAISAS) — Empresa 2 (PAISASFISCAL) aún no está integrada." Idealmente calculado dinámicamente: `getInventoryValuation()` retorna también `dbSourcesIncluded: string[]` (distinct `db_source` presente en `inventory_master`), y el frontend arma el texto a partir de eso en vez de hardcodear "Empresa 1" — así el aviso se autocorrige solo cuando lleguen datos BD2.

Ver tareas concretas en `tasks.md` Bloque H (TASK-D20 a TASK-D25).

## 11. Addendum (2026-07-13): usabilidad del dashboard tras uso real

### 11.1 Historial de Sesiones: columna de categoría + drill-down

- `getSessionsSummary()` (`inventory-analytics.ts`): incluir `category_filter` de `inventory_sessions` en el `select`. En `InventoryAnalysisTab.tsx`, columna nueva "Categoría" con un badge (mostrar "Todas" si `category_filter` es `null`).
- Nueva función `getSessionDetail(sessionId: string)`: trae `inventory_counts` de esa sesión con join a `inventory_master` (`sku`, `description`, `system_stock`, `counted_quantity`, `expected_stock`, diferencia, `cost_avg` para valor del descuadre puntual).
- Cada fila de la tabla de historial pasa a ser clickeable (`cursor-pointer hover:bg-white/10`) y abre un modal/panel lateral (reusar patrón de modal ya existente en el proyecto, ej. el del wizard) con el detalle de `getSessionDetail()`: lista de ítems, cuáles tuvieron descuadre resaltados, totales.

### 11.2 KPI "Conteos Pendientes" navegable

- Nueva función `getPendingSession()` (o extender `getInventoryStats()`): si `pendingSessions > 0`, devolver también el `id`/`link_token` de la sesión pendiente más antigua (o la lista si hay más de una).
- La `StatsCard` de "Conteos Pendientes" en `src/app/inventario/page.tsx` pasa a ser clickeable cuando `pendingSessions > 0`: al hacer click, abre el wizard/panel de esa sesión específica (reusar el flujo de reanudar sesión ya construido para pause/resume) en vez de dejar al admin sin forma de encontrarla.

### 11.3 Botón "Historial" funcional

- El botón en `src/app/inventario/page.tsx` (línea ~111, sin `onClick`) debe cambiar a la pestaña "Análisis y Consolidados" y hacer scroll (`scrollIntoView`) hasta la sección "Historial de Sesiones" de `InventoryAnalysisTab.tsx`.

### 11.4 Ajuste visual: tamaño de tarjetas

- La tarjeta de "Valorización y Pérdidas"/"Valor Estimado de Descuadre" debe ajustar su ancho/alto para ser consistente con el resto de tarjetas del grid (no ocupar el doble de espacio) — revisar el grid que la contiene junto a "Cobertura de Catálogo" y unificar alturas con `items-stretch`/misma clase de padding.
- Las 4 `StatsCard` superiores de `/inventario` (Total Productos, Descuadres Detectados, Conteos Pendientes, Última Sincronización) reducen su padding vertical (de `p-6`/similar a algo más compacto, ej. `p-4`) para bajar la altura total sin perder legibilidad.

Ver tareas concretas en `tasks.md` Bloque I (TASK-D26 a TASK-D31).

## 12. Addendum (2026-07-13): reconciliación de descuadre al cierre de sesión

Ver `spec.md` addendum para el diagnóstico y la restricción de datos descubierta (Order/Invoice de Milenium no traen detalle de línea por SKU, solo `total` de cabecera).

### 12.1 Migración: columnas de reconciliación

**Archivo nuevo:** `supabase/migrations/018_reconciliacion_cierre.sql`
- Agregar a `inventory_counts`: `system_stock_at_close numeric null`, `reconciliation_note text null`.
- No se toca `expected_stock` (queda como el valor histórico capturado durante el conteo — es el "bruto"); `system_stock_at_close` es el valor fresco consultado al cerrar. `reconciled_discrepancy` se calcula on-the-fly (`counted_quantity - coalesce(system_stock_at_close, expected_stock)`), no se materializa.

### 12.2 Backend: reconciliación al cierre

- Modificar `finish_mobile_count_session` (RPC, migración 017) y el flujo de cierre del wizard desktop equivalente: al cerrar, por cada `inventory_counts` de esa sesión, llamar `getFlexCrm(db).getOneProduct(item)` (ya existe en `flex-crm.ts`, endpoint `/crm/one/product`) para el SKU correspondiente, obtener `existencia_total` fresco, y:
  - Si `existencia_total` (fresco) ≠ `expected_stock` (capturado durante el conteo): guardar `system_stock_at_close = existencia_total` y `reconciliation_note = 'Stock del sistema cambió de {expected_stock} a {existencia_total} durante la sesión (posible venta u otro movimiento). Descuadre recalculado.'`.
  - Si no cambió: dejar ambos campos `null` (sin nota, no hubo nada que reconciliar).
  - Tolerante a fallos parciales: si la consulta a Milenium falla para algún SKU (timeout, etc.), continuar sin bloquear el cierre de la sesión — el valor bruto queda como único disponible para ese ítem.
- `inventory_session_summary` (vista, migración 016): `discrepancy_value` pasa a calcularse con `coalesce(system_stock_at_close, expected_stock)` en vez de solo `expected_stock`, para que el valor de descuadre de la sesión ya refleje la reconciliación.

### 12.3 Frontend: mostrar la reconciliación

- En el modal de detalle de sesión (Bloque I, TASK-D27): por cada ítem con `reconciliation_note` no nulo, mostrar un badge/ícono distinto ("Reconciliado") y la nota completa al hacer hover/click. El descuadre bruto tachado + el neto al lado, para que quede claro que hubo un ajuste.
- Aviso general (una sola vez, no por ítem) en la sección de Valorización: "Los descuadres se recalculan automáticamente al cerrar cada sesión contra el stock más reciente de Milenium para los productos contados, para no confundir ventas legítimas con pérdidas reales."

### 12.4 Riesgo y pendiente con Ricardo

Esta reconciliación usa el *stock resultante* como proxy de "hubo movimiento", no la venta real — dos ventas y una devolución podrían compensarse y no detectarse, o un ingreso de mercancía podría confundirse con "no hubo pérdida" cuando sí la hubo. Es la mejor aproximación posible con los datos actuales, pero no es perfecta. Pendiente real para Ricardo: un endpoint con detalle de línea (`item`, `cantidad`) por pedido/factura permitiría atribuir el ajuste a ventas específicas en vez de inferirlo del delta de stock.

Ver tareas concretas en `tasks.md` Bloque J (TASK-D33 a TASK-D37).
