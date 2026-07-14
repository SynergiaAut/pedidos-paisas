# SPEC (P0): Confiabilidad de datos — backfill de ventas, timeout de BD1, zona horaria
> Generado: 2026-07-14
> Proyecto: Fast Order (Pedidos Paisas)
> Handoff: Claude/Cowork → Antigravity
> Relacionado: `SPEC_auditoria-datos-inventario_20260714.md` (auditoría amplia), `SPEC_fix-graficos-comportamiento_20260714.md`

---

## 0. POR QUÉ (evidencia — ya diagnosticado)

Los tableros de Comportamiento **presentan bien** (3 líneas, KPI desglosado Interna/Fiscal, pestaña Calidad de Datos), pero **los datos aún no son confiables**. Tres causas verificadas:

- **`sales_lines` incompleta:** el sync de ventas por defecto trae **solo las últimas 24 h** (`src/lib/sales-sync.ts`, ~líneas 36-38) y el backfill no cubrió todos los días → el diario tiene un **pico de $62M el 07-jul y ~$0 el resto**, y **2.318 SKUs (59%) salen como "sin ventas"** (dead stock falso).
- **Sync de BD1 falla por timeout:** banner *"BD01: Query timeout after 25000ms"* (BD2 sí completó en 87 s). El inventario de BD1 puede quedar **stale**.
- **Zona horaria:** el intradía arranca a las **03:00** porque `captured_at`/lectura están en **UTC** (Colombia es UTC-5). Además el intradía (en vivo) contradice el diario (que no tiene los días completos).

**Regla:** no mostrar los tableros de ventas al cliente como confiables hasta cerrar P1 y P3. La pestaña Calidad de Datos sí es presentable.

## 1. CONSTITUTION (aplicable)
- API solo por `flex-crm.ts`; `db_source`; idempotencia; **sync server-side**; degradar sin romper; no saturar el túnel (Art. 2/4). No romper lo que ya funciona.

## 2. TASKS

### P1 — [P0] Completar el backfill de `sales_lines`
- Ejecutar/implementar un **backfill real del período objetivo** (ej. últimos 90 días, configurable) por **lotes de días/semanas**, para **BD1 y BD2**, con upsert idempotente; que no bloquee la UI ni sature el túnel.
- Mantener el **incremental** (cron) para el día en curso.
- **Verificar cobertura:** filas por día, sin huecos, y `min/max(fecha)` que cubra el período. (Diagnóstico rápido: `select count(*), min(fecha), max(fecha), count(distinct fecha) from sales_lines;`)
- *Resultado:* el diario muestra todos los días con valores reales; el dead-stock refleja no-vendedores reales (no huecos de datos).
- Archivos: `src/lib/sales-sync.ts`, `src/app/api/milenium/sync-ventas/route.ts`.

### P2 — [P0] Arreglar el timeout del sync de BD1
- El pull de `/crm/all/product` de BD1 supera los 25 s y falla. Subir el **timeout** (BD2 tardó 87 s y pasó → alinear), y/o **paginar/filtrar** el pull; **reintentar** con backoff; y que un timeout **no deje el inventario stale en silencio** (avisar en el banner con la hora del último sync exitoso).
- Revisar por qué BD1 (2.145 ítems) tarda más que antes (¿túnel lento, payload mayor?).
- *Resultado:* BD1 sincroniza sin fallar; el inventario no queda desactualizado.
- Archivos: `src/lib/flex-crm.ts` (timeout del POST), `src/lib/inventory-sync.ts`.

### P3 — [P0] Zona horaria del intradía (Colombia, UTC-5)
- Al **capturar** el snapshot, el día de negocio (`dia`) debe ser la **fecha local de Colombia** (reusar `getColombiaDateString()` de `src/app/actions/pedidos-capture.ts`).
- Al **leer/graficar**, mostrar `captured_at` en **hora local de Colombia** y que el corte de día (reinicio del acumulado) sea a la medianoche local.
- *Resultado:* la curva refleja el horario real de operación (sin "ventas a las 03:00").
- Archivos: captura del snapshot (sync/cron), `sales-analytics` (lectura intradía), `src/components/inventory/BehaviorTab.tsx`.

### (Fuera de este P0 — queda en la auditoría)
- **Unidades de BD2** (el "5.1M"): normalizar/decidir cómo tratar unidades entre bases → tarea A de `SPEC_auditoria-datos-inventario`. No bloquea, pero ese número no es interpretable hasta resolverlo.

## 3. CONTEXTO PARA ANTIGRAVITY
### Keywords
- sales_lines backfill 24 horas incompleto
- crm/all/product timeout BD1 stale
- captured_at UTC zona horaria Colombia intradia
### Próximo paso
Empezar por **P1** (backfill completo — es lo que más distorsiona los tableros) y **P2** (timeout BD1) en paralelo; luego **P3** (zona horaria). Verificar con `select count(*), min(fecha), max(fecha), count(distinct fecha) from sales_lines;` antes y después.
### Recordatorio operativo
`git add -A` antes de commitear; no duplicar números de migración (último = `025` → `026` si hiciera falta).
