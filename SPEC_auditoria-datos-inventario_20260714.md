# SPEC: Auditoría de datos de inventario + estándar visual de base (Interna/Fiscal)
> Generado: 2026-07-14
> Proyecto: Fast Order (Pedidos Paisas)
> Handoff: Claude/Cowork → Antigravity

---

## 0. HALLAZGOS (diagnóstico ya hecho — NO re-descubrir)

Investigando por qué los tableros de Comportamiento muestran números raros, se confirmó lo siguiente:

1. **El stock inflado de BD2 NO es un bug del sync.** Para el SKU `2301005` (arroz), la API devuelve **una sola entrada** de `stock[]` por base, y el sync la guarda fiel:
   - BD1 (01) → "ARROZ BOLUGA **PREMIUM** X 500**G**" · stock **82.386**
   - BD2 (02) → "ARROZ BOLUGA X 500 **GR**" · stock **1.040.907,86**
   El valor grande viene **tal cual del ERP**. (Verificado con `scripts/debug-stock-bd2.mjs`.)
2. **El mismo código NO representa el mismo producto ni la misma unidad entre bases.** Descripciones distintas + magnitudes/decimales muy distintos → BD2 usa **otra unidad de medida** o semántica de stock. **Conclusión: unificar el inventario "por SKU" entre BD1 y BD2 está mal de raíz.** Contamina el catálogo unificado, el KPI de unidades y todo cruce entre bases.
3. **`sales_lines` probablemente está incompleta:** el diario da cifras muy bajas ($231k/día) y staples (arroz, azúcar) aparecen como "sin ventas" (dead stock), lo que es imposible → el backfill de ventas no trajo todas las facturas.
4. **Son problemas de DATOS FUENTE**, no de "SQL vs pandas". Se resuelven auditando, corrigiendo en el ERP donde aplique, y validando en la ingesta. Producción sigue en Supabase/Postgres (constitución Art. 1). **No** introducir un servicio Python/pandas de producción; pandas solo es aceptable como herramienta offline de perfilado si se necesita.

## 1. CONSTITUTION (aplicable)

- Stack fijo: Next.js + Supabase (Art. 1). Sin servicios paralelos de producción.
- API solo por `flex-crm.ts`; `db_source` en todo; sync server-side; RLS admin (Art. 2/3).
- **Aditivo:** no romper Catálogo, Análisis, Comportamiento, KPI ni los syncs.
- Errores/valores imposibles se **registran y se marcan**, nunca entran callados (Art. 4).

## 2. TASKS

### A — [P0] Auditoría de alineación BD1↔BD2 y unidades
- Medir el solape de SKUs entre bases: cuántos códigos coinciden, y de esos, cuántos tienen **descripción distinta** y/o **unidad distinta**.
- Determinar la **unidad de medida** que usa cada base (revisar `ID_UNIDAD_COMPRA`/`DESCRIPCION_UNIDAD` del payload de la API por base).
- **Decisión de diseño a resolver (documentar):** o se tratan BD1 y BD2 como **catálogos separados** (recomendado si el código no significa lo mismo), o se construye una **tabla de mapeo** real BD1↔BD2. **Mientras no se resuelva, NO sumar "unidades" entre bases** (el KPI de unidades debe mostrarlas separadas, no un total mezclado).
- *Resultado:* informe corto con los números del solape + recomendación de tratamiento.

### B — [P0] Completitud de `sales_lines` y re-backfill
- Auditar `sales_lines`: total de filas, rango de fechas cubierto, días con datos, y facturas capturadas vs. las que reporta la API en ese rango (por BD).
- Si falta cobertura, **rehacer el backfill** por lotes (rango configurable) hasta cubrir el período que se quiere analizar, sin bloquear la UI y sin saturar el túnel.
- *Resultado:* `sales_lines` completo y verificable; el diario y el dead-stock dejan de estar sesgados por huecos.

### C — [P1] Reporte de inconsistencias para el cliente
- Vista/exportable **"Calidad de datos (a revisar)"** que liste, en tono de *revisión* (no de acusación):
  - SKUs presentes en BD1 y BD2 con **descripción divergente**.
  - Productos con **stock** o **costo** fuera de rango razonable (outliers; incluir los 3 SKU de costo corrupto ya conocidos: `2202007`, `701042`, `606042`).
  - Productos **sin unidad** o con unidad inconsistente entre bases.
- Exportable a Excel/PDF para que el equipo de Camilo lo **corrija en el ERP (Millenium)**, que es la fuente.
- *Resultado:* entregable accionable para el cliente; transparencia como valor.

### D — [P1] Estándar visual de identificación de base
Mantener los nombres actuales (**Interna** = 01, **Fiscal** = 02) y agregar **color consistente**, definido **una sola vez** (mapa `DB_STYLES` + componente `<DbBadge db="01"|"02" />`) y aplicado en TODA la app: columna "Origen" del catálogo, KPIs, **series y leyenda de los gráficos**, y el ticket.

Paleta propuesta (a discreción; se puede ajustar):
- **Interna (01):** índigo — badge `bg-indigo-500/15 text-indigo-300 border border-indigo-500/30`; color de serie en gráficos `#6366F1`.
- **Fiscal (02):** esmeralda — badge `bg-emerald-500/15 text-emerald-300 border border-emerald-500/30`; color de serie `#10B981`.
- **General (solo gráficos, el total):** gris neutro `#94A3B8` para que las dos bases resalten.

Reglas: **siempre** color + etiqueta de texto (nunca color solo — daltonismo y ticket en B/N); badge sutil, no llamativo. **Verificar que la etiqueta corresponda correctamente a cada base** antes de aplicarla en todo (hoy la app muestra 01=Interna, 02=Fiscal).
- *Resultado:* origen de cada producto/serie reconocible al instante y de forma coherente.

### E — [P1] Reglas de validación en el sync
- En el sync de inventario, **marcar (no eliminar)** valores imposibles: stock o costo por encima de un umbral configurable, o descripciones/unidades divergentes entre bases → una bandera `needs_review` (o similar) + log con contexto.
- Alimenta el reporte de la tarea C y evita que un valor absurdo envenene los tableros en silencio.
- *Resultado:* la mala calidad de dato se detecta en la ingesta, no en el análisis.

## 3. CONTEXTO PARA ANTIGRAVITY

### Keywords para el KM
- auditoria datos inventario BD1 BD2 unidades alineacion
- sales_lines backfill completitud
- system_stock outlier ERP millenium calidad de datos
- DbBadge Interna Fiscal color estandar
- needs_review validacion sync

### Archivos relevantes
- `src/lib/flex-crm.ts` — payload de producto (stock[], unidad); `existencia_total` = suma de `stock[].CANTIDAD` (no es el bug, pero es donde vive el stock)
- `src/lib/inventory-sync.ts`, `src/lib/inventory-mapper.ts` — sync/mapeo (validaciones tarea E)
- `src/lib/sales-sync.ts`, `src/app/api/milenium/sync-ventas/route.ts` — backfill de ventas (tarea B)
- `src/components/inventory/UnifiedStockTable.tsx`, `BehaviorTab.tsx`, `src/app/inventario/page.tsx` — dónde aplicar el estándar visual (tarea D)
- `src/app/pedidos/imprimir/[id]/page.tsx` — badges de base en el ticket (tarea D)
- `scripts/debug-stock-bd2.mjs`, `scripts/validate-pedidos.mjs` — utilidades de diagnóstico ya existentes
- `.spec/constitution.md` — Art. 1 (stack), Art. 2/3/4

### Próximo paso recomendado
Empezar por **A** y **B** (entender el alcance real: qué tan desalineadas están las bases y qué tan incompleto está `sales_lines`). Esas dos definen todo lo demás. Luego C (reporte), D (estándar visual) y E (validaciones).

### Recordatorio operativo
Aplicar en Supabase las migraciones pendientes; `git add -A` antes de commitear; no duplicar números de migración (último = `025` → usar `026`).
