# SPEC (FIXES): Confiabilidad de los gráficos de Comportamiento (intradía + diario)
> Generado: 2026-07-14
> Proyecto: Fast Order (Pedidos Paisas)
> Handoff: Claude/Cowork → Antigravity
> Relacionado: `SPEC_comportamiento-intradia-snapshots_20260714.md`, `.spec/analisis-comportamiento-productos/spec.md`

---

## 0. DIAGNÓSTICO (lo que se encontró revisando el código — NO re-descubrir)

Los dos gráficos de la pestaña Comportamiento muestran **datos no confiables**. Hallazgos verificados en el repo:

1. **Diario truncado por el tope de 1.000 filas.** `getProductsBehaviorData` (`src/app/actions/sales-analytics.ts`) lee `sales_lines` con `.select('*').gte('fecha', limitDate)` **sin `.limit()` ni paginación** → PostgREST devuelve **máx. 1.000 filas**. Como hay decenas de miles de líneas, la suma diaria queda truncada (~4% de lo real). Por eso "Venta Bruta" muestra ~$231k/día cuando el real ronda los millones (~158 facturas/día × ~$40k).
2. **Intradía sobre código DESINCRONIZADO.** `src/components/inventory/BehaviorTab.tsx` importa `getIntradaySnapshots` e `IntradayPoint` desde `sales-analytics.ts`, **pero esas exports NO existen en ese archivo** (355 líneas, sin nada de "Intraday"). Además **ningún archivo fuente lee/escribe la tabla `sales_snapshots`** (creada en `024_sales_snapshots.sql`). O sea, lo que se ve en pantalla viene de una versión desincronizada (muy probablemente por el enredo de git recurrente). Ambos archivos figuran como modificados sin commitear.
3. **Zona horaria en UTC.** `sales_snapshots.captured_at` usa `default timezone('utc', now())` y no se convierte a hora local. Colombia es **UTC-5** → la curva sale corrida (ej. "ventas a las 4:00 AM") y el corte de día (reinicio del acumulado) queda mal. Ya existe `getColombiaDateString()` en `src/app/actions/pedidos-capture.ts` como patrón a reusar.

**Prioridad:** primero reconciliar el desync (G1); si no, se arreglan cosas sobre código que no es el que corre.

## 1. CONSTITUTION (aplicable)

- **Idempotencia y agregación en el servidor** (Art. 2/4): las sumas grandes se hacen con funciones SQL/RPC, no trayendo miles de filas al cliente (evita el tope de 1.000).
- **`db_source` y RLS admin** en ventas/snapshots (Art. 2/3).
- **No romper** la ficha por producto, el KPI, ni los syncs. Aditivo/correctivo.
- **Git:** `git add -A` antes de commitear (el índice queda enredado) y **no duplicar números de migración** (el último es `024` → usar `025`).

## 2. TASKS

### G1 — [P0] Reconciliar el desync de git y el intradía
- Revisar por qué `getIntradaySnapshots`/`IntradayPoint` los importa `BehaviorTab` pero no existen en `sales-analytics.ts`. Recuperar/rehacer esas exports (revisar historial de git; puede haber trabajo perdido en el enredo de índice).
- Confirmar que la captura **escribe** en `sales_snapshots` (en el tick del sync, como en `SPEC_comportamiento-intradia-snapshots`) y que `getIntradaySnapshots` **lee** de `sales_snapshots`. Hoy nada toca esa tabla desde el código fuente.
- `git add -A`, verificar que no se perdió trabajo, y `npm run build` sin errores (esta desincronización debería ser un error de compilación).
- **Resultado:** el intradía corre sobre código real y consistente, leyendo `sales_snapshots`.

### G2 — [P0] Agregación server-side (quitar el tope de 1.000 filas)
- **Diario:** reemplazar la suma en cliente de `getProductsBehaviorData` por una **función SQL/RPC** que agrupe `sales_lines` por `fecha` y sume `total`/`total_costo` (excluyendo los SKUs de costo corrupto `['2202007','701042','606042']`), para el período pedido. Igual criterio para top/bottom y márgenes si también leen sin límite.
- **Intradía:** el agregado de "hoy por BD" para los snapshots también por RPC (no `select *`).
- Usar el **siguiente número de migración libre (`025`)** para las funciones. Idempotentes (`create or replace`).
- **Resultado:** el diario muestra cifras reales (millones, no $231k), sin truncar.

### G3 — [P1] Zona horaria Colombia (UTC-5)
- Al **capturar** el snapshot: el "día de negocio" (`dia`) debe ser la fecha local de Colombia (reusar `getColombiaDateString()`), no UTC.
- Al **leer/graficar** intradía: mostrar `captured_at` en hora local de Colombia y que el eje/curva y el corte de día (reinicio del acumulado a medianoche) usen hora local.
- **Resultado:** la curva refleja el horario real de operación (sin "ventas a las 4:00 AM") y el acumulado reinicia a la medianoche correcta.

### G4 — [P1] Ver las 3 líneas a la vez (BD1 / BD2 / General)
- Hoy `BehaviorTab` tiene el toggle `activeIntradayDb: '01' | '02' | 'all'` (cambia entre una u otra). Agregar un modo que **renderice las tres series simultáneamente** (BD1, BD2 y General) en el mismo gráfico, con leyenda y colores distintos. Mantener el toggle `cumulative | delta`.
- **Resultado:** el usuario ve BD1, BD2 y el total al tiempo, como pidió.

## 3. CONTEXTO PARA ANTIGRAVITY

### Keywords para el KM
- sales_lines limit 1000 paginacion RPC agregacion
- getIntradaySnapshots sales_snapshots desincronizado
- captured_at UTC zona horaria Colombia getColombiaDateString
- BehaviorTab intradia BD1 BD2 general tres series

### Archivos relevantes
- `src/app/actions/sales-analytics.ts` — `getProductsBehaviorData` (tope 1.000, G2); falta `getIntradaySnapshots`/`IntradayPoint` (G1)
- `src/components/inventory/BehaviorTab.tsx` — importa lo que no existe (G1); toggle `activeIntradayDb`/`intradayViewMode` (G4)
- `supabase/migrations/024_sales_snapshots.sql` — tabla de snapshots (nadie la lee/escribe aún — G1)
- `src/app/actions/pedidos-capture.ts` — `getColombiaDateString()` a reusar (G3)
- `src/lib/sales-sync.ts`, `src/instrumentation.ts` — sync/cron donde debe ocurrir la captura del snapshot

### Próximo paso recomendado
**G1 primero** (reconciliar git + dejar el intradía leyendo `sales_snapshots` de verdad). Luego G2 (agregación real), G3 (zona horaria) y G4 (3 líneas). Validar con los datos reales de hoy antes de dar por bueno cualquier número.

### Recordatorio operativo
Aplicar en Supabase lo que falte (`021_sales_lines`, `022`, `023`, `024`) y la nueva `025`. `git add -A` antes de commitear; no duplicar números de migración.
