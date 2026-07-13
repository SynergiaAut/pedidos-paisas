# Spec: Dashboard de consolidados de sesiones de inventario

**Fase SDD:** Specification → Clarification resuelta en esta sesión → lista para `plan.md`.
**Origen:** hallazgo de usabilidad al probar conteo móvil en vivo (2026-07-12): no hay ninguna vista que consolide sesiones de conteo, y el catálogo general no distingue lo ya contado. Sin dependencias de Ricardo/BD2.

## Problema que resuelve

Hoy `inventory_counts` es un log ciego: cada conteo (desktop o móvil) inserta filas, pero no existe ninguna pantalla que las agregue. Camilo/Alejandra no pueden responder preguntas básicas de gestión: ¿cuántas sesiones se han hecho?, ¿qué tan seguido hay descuadres?, ¿va mejorando o empeorando?, ¿qué productos son un problema recurrente (posible hurto, mal registro, mal etiquetado)? Tampoco el catálogo general (`UnifiedStockTable`) distingue qué se contó hace poco — todo se ve igual, ordenado solo alfabéticamente.

## Usuarios objetivo

- **Camilo (dueño):** quiere ver el panorama — cobertura, tendencia, impacto económico de los descuadres.
- **Alejandra (admin):** quiere revisar rápido qué se contó, qué falta, y qué productos investigar.

## Historias de usuario

- Como dueño, quiero ver el historial de sesiones de conteo (nombre, fecha, modo, % completado, quién la cerró, estado), para saber si el proceso cíclico se está cumpliendo.
- Como dueño, quiero ver cuántos ítems tuvieron descuadre por sesión y su valor estimado, para dimensionar el impacto económico.
- Como dueño, quiero ver la tendencia de descuadres y cobertura a través de las sesiones, para saber si el proceso mejora o empeora.
- Como dueño, quiero un ranking de los productos que más se repiten con descuadre entre sesiones distintas, para investigarlos puntualmente.
- Como dueño, quiero saber qué porcentaje del catálogo total ya se ha contado al menos una vez, para saber cuánto inventario sigue "a ciegas".
- Como admin, quiero que el Catálogo Unificado y la vista de una sesión activa muestren primero los ítems ya contados (con cuándo y en qué sesión), para revisar de un vistazo sin tener que buscar.

## Criterios de aceptación

- [ ] Nueva sección/pestaña "Análisis" en `/inventario` con: tarjeta de cobertura (% de catálogo no-servicio con al menos un conteo físico), gráfico de tendencia de descuadres por sesión (recharts, ya está en el stack), tabla de historial de sesiones, y tabla de ranking de productos problemáticos.
- [ ] Historial de sesiones: nombre, modo (desktop/móvil), fecha de inicio/cierre, estado, ítems contados / total esperado, cantidad de descuadres, valor estimado del descuadre.
- [ ] Ranking de productos problemáticos: producto aparece si tuvo descuadre (`counted_quantity ≠ expected_stock`) en **más de una sesión distinta**; ordenado por frecuencia y luego por magnitud acumulada del descuadre.
- [ ] Cobertura = `count(inventory_master.physical_stock is not null) / count(*)` sobre ítems no-servicio (`is_service = false`).
- [ ] `UnifiedStockTable` (Catálogo Unificado) ordena primero los ítems con conteo físico más reciente, con indicador visual de "Contado hace X · sesión Y"; el resto sigue alfabético.
- [ ] La vista de una sesión activa/reciente (wizard desktop y el resumen de progreso del conteo móvil) también muestra primero los ítems ya guardados en esa sesión.
- [ ] `inventory_master.physical_stock` y un nuevo `last_counted_at` se actualizan en cada conteo válido (desktop o móvil) — sin tocar nunca `system_stock` (el teórico de Milenium). Ver Clarifications.
- [ ] Todo el cálculo (cobertura, tendencia, ranking) corre server-side (server actions o vista SQL), nunca trayendo toda `inventory_counts`/`inventory_master` al cliente para agregar en el navegador.

## Fuera de alcance (esta fase)

- Ajustar automáticamente el stock del ERP Milenium a partir de los conteos (sigue siendo ajuste manual del dueño en el ERP).
- Alertas/notificaciones automáticas de descuadre (push, email, WhatsApp).
- Exportar el dashboard a Excel/PDF.
- Analítica por bodega física dentro de una sucursal (no aplica — el Granero es un solo punto).

## Clarifications

1. **¿`inventory_counts` sigue siendo insert-only?** Sí, sin cambios — sigue siendo el ledger histórico de cada conteo individual, base de todo el análisis de este spec.
2. **¿Se cambia la política de "nunca sobreescribir stock"?** Se precisa, no se cambia: esa regla siempre se refirió a `system_stock` (el stock teórico que trae Milenium vía sync) y **sigue sin tocarse nunca** por conteos. Lo que se decide ahora es que `physical_stock` — el campo que la migración 013 ya dejó preparado con la semántica "NULL = nunca contado" — sí se actualiza en cada conteo válido, exactamente como se diseñó originalmente antes de la feature de conteo móvil. Esto es lo que permite mostrar "ya contado" en el catálogo general sin tener que unir contra `inventory_counts` cada vez.
3. **¿Qué es "impacto económico" de un descuadre?** `abs(counted_quantity - expected_stock) * cost_avg` del producto — valor absoluto para dimensionar magnitud; se puede desglosar en faltante/sobrante con el signo si se necesita después.
4. **¿"Producto problemático" cuenta un descuadre en la misma sesión dos veces?** No — se cuenta por sesión distinta con al menos un descuadre de ese producto (si se corrige y se cuenta de nuevo en la misma sesión, es un solo evento).
5. **¿La tendencia en el tiempo es por día calendario o por sesión?** Por sesión (ordenadas por fecha de cierre) — las sesiones no son diarias, y agrupar por sesión es más honesto que inventar una granularidad diaria que no existe en la operación real del Granero.

## Siguiente paso

`plan.md` con el diseño técnico (vista/consulta SQL de agregación, server actions, componentes de UI con recharts, cambio de orden en `UnifiedStockTable` y en la vista de sesión) → `tasks.md` atómico → implementación en Antigravity.

## Addendum (2026-07-12): hallazgo de confiabilidad de datos en Valorización y Pérdidas

Johnathan cuestionó las cifras de valorización mostradas tras el Bloque G (TASK-D16-D19). Investigación confirmó:

1. **Contaminación por sesiones de prueba**: las 2 sesiones sembradas por Antigravity durante el desarrollo ("Conteo Móvil Pasillo A - Dulces", "Conteo Semanal Confitería - Semana 27") seguían en la base de datos, aportando 6.48% ($70.909,96 COP) del descuadre total mostrado. Deben borrarse — nunca debieron mezclarse con datos operativos reales.
2. **Outlier crítico de datos corruptos**: `inventory_master` SKU `2202007` ("LATON SIXPACK CERVEZA CLUB COLOMBIA") tiene `cost_avg` = $50.172.233.299.062,07 COP — un error de escala en el dato sincronizado desde Milenium (no un bug de Fast Order), que introduce ~$1.68 cuatrillones COP de ruido en cualquier suma que lo incluya sin filtrar.
3. **290 de 1.694 productos no-servicio (17.1%) tienen `cost_avg = 0`** — subvalora tanto la valorización como cualquier % de cobertura basado en costo.
4. **Alcance BD1-only no declarado**: hoy 0 filas de `inventory_master` tienen `db_source = '02'` (BD2) — la "valorización total" solo refleja la Empresa 1 (GRANESLOSPAISAS) y esto no se comunica en la UI.

Ver `plan.md` §10 y `tasks.md` Bloque H para la remediación.

## Addendum (2026-07-13): mejoras de usabilidad del dashboard (hallazgo de uso real)

Johnathan usó el dashboard en producción y reportó 5 oportunidades de mejora:

1. **Historial de Sesiones sin contexto de categoría**: no se ve qué tipo de productos se contó en cada sesión (`category_filter` ya existe en `inventory_sessions` pero no se muestra).
2. **Sin drill-down**: hacer click en una fila del historial no lleva a ningún detalle de esa sesión (ítems contados, descuadres puntuales).
3. **KPI "Conteos Pendientes" sin acción**: muestra "1" pero no hay forma de encontrar ni retomar esa sesión desde el panel admin.
4. **Botón "Historial" (arriba de `/inventario`) no hace nada** — es un `<button>` sin `onClick`.
5. **Tarjeta "Valor Estimado de Descuadre"/Valorización ocupa demasiado espacio** y las tarjetas KPI superiores son más altas de lo necesario.

Ver `plan.md` §11 y `tasks.md` Bloque I.

## Addendum (2026-07-13): reconciliación de descuadre al cierre de sesión

**Origen:** pregunta de Johnathan — ¿qué pasa si se vende un producto mientras se está contando en horario de producción? Diagnóstico: `submit_mobile_count`/el flujo desktop ya capturan `expected_stock` en vivo desde `inventory_master.system_stock` en el momento de cada conteo (no un valor cacheado del inicio de sesión), pero `system_stock` en sí solo se actualiza en el último sync con Milenium (hoy manual, cada 15 min tras el fix de `.spec/integracion-api-2bd/` §6). Si una venta ocurre entre el último sync y el conteo, el sistema puede reportar como "pérdida" unidades legítimamente vendidas.

**Restricción de datos descubierta:** los endpoints de Milenium para pedidos/facturas (`/crm/all/order`, `/crm/one/invoice`) solo devuelven un `total` pre-calculado a nivel de cabecera — **no hay detalle de línea por SKU/cantidad**. Esto significa que no podemos "netear ventas reales" de forma literal (no hay forma de saber cuántas unidades de un SKU específico se vendieron en una ventana de tiempo) sin pedirle a Ricardo un endpoint nuevo con detalle de línea. Se documenta como pendiente adicional en `.spec/integracion-api-2bd/`.

**Solución disponible con los datos actuales:** al cerrar una sesión de conteo, re-consultar en vivo (no esperar al próximo sync) el `system_stock` actual de Milenium solo para los SKU tocados en esa sesión (vía `/crm/one/product`), y usar ese valor fresco para recalcular el descuadre final en vez del valor que tenía `system_stock` en el momento en que se contó cada ítem. Se guardan ambos valores (bruto y reconciliado) y se deja una nota explicando el ajuste, con lenguaje honesto: no se puede afirmar "se vendieron N unidades" (no hay ese dato), pero sí "el stock del sistema cambió de X a Y durante la sesión (posible venta u otro movimiento)".

Ver `plan.md` §12 y `tasks.md` Bloque J.
