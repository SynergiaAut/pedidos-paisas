# Spec: Graficas de comportamiento acordes a cobertura real

Fecha: 2026-07-17

## Contexto

Las graficas de la pestaña Comportamiento pueden inducir lecturas incorrectas:

- El intradia genera intervalos con ceros aunque no haya ventas reales ni snapshots utiles para la fecha.
- El historico de ventas diarias queda visualmente aplastado cuando hay un dia con pico grande.
- La UI no informa hasta que fecha llegan las ventas sincronizadas desde Millenium.

Auditoria paginada con `scripts/audit-sales-chart-data.mjs`:

- `sales_lines`: 2.514 filas, rango 2026-06-15 a 2026-07-15.
- `sales_snapshots`: 2.739 filas, dias 2026-07-15 a 2026-07-17.
- 2026-07-16 y 2026-07-17 tienen snapshots con venta maxima 0.
- Primer sync manual 2026-07-16 a 2026-07-17 respondio `0` facturas porque `sales-sync.ts` enviaba fechas en `DD/MM/YYYY`.
- Probe directo contra Flex CRM confirmo que `/crm/all/invoice` exige `YYYY-MM-DD`: para 2026-07-16 a 2026-07-17 retorno 399 facturas BD1 y 904 facturas BD2.
- Se corrigio `formatDateToCrm()` para emitir `YYYY-MM-DD`.
- Sync corregido 2026-07-16 a 2026-07-17: BD1 399 facturas / 662 lineas; BD2 904 facturas / 3.376 lineas.
- Cobertura posterior: `sales_lines` 6.552 filas, rango 2026-06-15 a 2026-07-17.

## Objetivo

Hacer que las graficas comuniquen la realidad de los datos:

- Si una fecha intradia no tiene ventas/snapshots utiles, mostrar estado vacio en vez de una linea plana de ceros.
- Mostrar frescura/cobertura de los datos historicos.
- Usar una visualizacion historica menos engañosa ante picos grandes.

## No objetivos

- No re-sincronizar automaticamente ventas en esta fase.
- No alterar `sales_lines` ni `sales_snapshots`.
- No cambiar la logica de negocio de margen/top sellers.
