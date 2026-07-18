# Módulo: Cuadre diario

**Problema:** al cierre del día, cuadrar lo capturado en la app contra la caja real.

## Funcionalidad

- `/cuadre`: resumen del día por estado de pedidos y totales; apoyo al cierre de caja.
- Cierre operativo guardado por fecha en `daily_cash_closures`: esperado cobrado, efectivo, transferencias, tarjeta, gastos, diferencia, notas y estado (`BORRADOR`/`CERRADO`).
- Pestaña **Cuadre por vendedor**: agrega `sales_lines` por `id_vendedor` para ver ventas reales sincronizadas desde el ERP, con desglose BD1/BD2. Depende de que el sync de ventas esté actualizado.
- RPC `calculate_daily_metrics` consolida métricas del día.
- `/analytics`: KPIs históricos (`src/app/actions/analytics.ts`): ventas diarias, comparación de periodos, top productos, breakdown por tipo de entrega, rendimiento de domiciliarios, patrones por día de semana, tendencias mensuales.

## Archivos clave

`src/app/cuadre/page.tsx`, `src/app/analytics/page.tsx`, `src/app/actions/analytics.ts`, `src/components/ui/DateFilter.tsx`.

## Datos

Lee `orders` (con `invoices_data` y `products` jsonb) y `delivery_drivers`. No escribe en Milenium: el cuadre contable oficial sigue siendo del ERP; esto es control operativo.

El esperado de caja se calcula con pedidos no cancelados en estado `ENTREGADO` o `PAGADO`. Los pedidos pendientes (`TOMADO`, `DESPACHO`, etc.) se muestran aparte como pendiente operativo para no convertirlos en falso faltante de caja.

## Nota de calidad

Los agregados se calculan sobre jsonb (`invoices_data`) — si cambia la estructura del jsonb en pedidos, revisar estas queries (candidato a vista SQL tipada cuando se consolide el baseline de migraciones).
