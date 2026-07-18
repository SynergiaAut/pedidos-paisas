# Spec: Cuadre diario operativo

**Fase SDD:** Specification inicial.
**Fecha:** 2026-07-18.

## Problema

La vista `/cuadre` agrupaba pedidos por domiciliario y permitia imprimir una liquidacion, pero no guardaba un cierre de caja. Eso dejaba dos lecturas mezcladas:

- Operacion/despacho: pedidos por estado, conductor y valor.
- Caja: dinero esperado vs dinero contado.

Para evitar romper despacho, el cierre debe vivir fuera de `orders`.

## Decision

Agregar una capa de cierre operativo por fecha en `daily_cash_closures`.

El esperado se calcula solo con pedidos activos en estado `ENTREGADO` o `PAGADO`. Los pedidos `TOMADO`/`DESPACHO` quedan como pendiente operativo y no deben leerse como faltante de caja.

## Alcance

- Panel en `/cuadre` con esperado cobrado, pendiente operativo, reportado y diferencia.
- Captura manual de efectivo, transferencias, tarjeta, gastos/egresos y notas.
- Pestañas de lectura: cuadre por domiciliario (`orders`) y cuadre por vendedor (`sales_lines` sincronizado desde ERP).
- Guardar borrador o cerrar el cuadre por fecha.
- Incluir resumen de cierre en la impresion del cuadre.

## Fuera de alcance

- No modifica `orders`.
- No escribe en Millenium.
- No valida medios de pago reales del ERP; por ahora el conteo por medio es manual.
- No reemplaza el cuadre contable oficial de Millenium.

## Criterios de aceptacion

- [ ] `/cuadre` carga pedidos y cierre guardado de la fecha seleccionada.
- [ ] El esperado excluye pedidos cancelados y solo suma entregados/pagados.
- [ ] El pendiente operativo muestra pedidos aun no entregados/pagados.
- [ ] La pestaña por vendedor agrupa `sales_lines` por `id_vendedor`, muestra total, facturas unicas y desglose BD1/BD2.
- [ ] Guardar borrador y cerrar usan `upsert` por `business_date`.
- [ ] La impresion incluye esperado, reportado, diferencia y notas.
