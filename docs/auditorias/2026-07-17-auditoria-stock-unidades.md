# Auditoria de stock y unidades: arroz / azucar

Fecha: 2026-07-17  
Objetivo: validar si los stocks atipicos de productos como arroz y azucar vienen desde Millenium/Flex CRM o si son producto de una mala interpretacion del backend de Fast Order.

## Conclusion ejecutiva

Para los productos revisados, **Fast Order esta copiando fielmente el valor que entrega Flex CRM**:

- `system_stock` en Supabase = suma de `stock[].CANTIDAD` entregado por la API.
- `delta_backend = 0` en las coincidencias revisadas de arroz y azucar.
- No se detecto duplicacion por bodegas en los casos criticos: el stock viene en una sola entrada `stock[]` con `ID_BODEGA=01`.

Por tanto, las cantidades fuera de escala **no parecen ser un bug del backend**. El problema probable esta en la calidad/configuracion del dato fuente en Millenium: unidades, presentaciones, equivalencias o existencias registradas con otra semantica aunque la API reporte `DESCRIPCION_UNIDAD=Unidad`.

## Evidencia principal

Comando usado:

```bash
node scripts/audit-stock-units.mjs arroz azucar azúcar
```

El script compara:

1. `inventory_master.system_stock` en Supabase.
2. Payload crudo de Flex CRM: `stock[].CANTIDAD`, `ID_UNIDAD_COMPRA`, `DESCRIPCION_UNIDAD`.
3. Diferencia calculada `delta_backend = Supabase_system_stock - API_sum_stock`.

Resultado global:

- `inventory_master`: 4.722 filas paginadas.
- Items no-servicio: 3.931.
- Coincidencias arroz/azucar en Supabase: 62.
- Outliers con stock absoluto mayor a 100.000: 8.

## Casos criticos

### Arroz

SKU `2301005`, BD2/Fiscal:

- Producto: `ARROZ BOLUGA X 500 GR`
- `ID_UNIDAD_COMPRA`: `Und`
- `DESCRIPCION_UNIDAD`: `Unidad`
- API `stock[]`: `ID_BODEGA=01`, `CANTIDAD=1.031.583,86`
- Supabase `system_stock`: `1.031.583,86`
- `delta_backend`: `0`

Validacion adicional con `scripts/debug-stock-bd2.mjs 2301005`:

- Entradas en `stock[]`: 1
- Bodegas distintas: 1
- Bodegas repetidas: 0

### Azucar

SKU `2302030`, BD2/Fiscal:

- Producto: `AZUCAR LA CABANA DE BULTO X LB`
- `ID_UNIDAD_COMPRA`: `Und`
- `DESCRIPCION_UNIDAD`: `Unidad`
- API `stock[]`: `ID_BODEGA=01`, `CANTIDAD=295.879,25`
- Supabase `system_stock`: `295.879,25`
- `delta_backend`: `0`

SKU `2302031`, BD2/Fiscal:

- Producto: `AZUCAR LUCERNA DE BULTO X LB`
- `ID_UNIDAD_COMPRA`: `Und`
- `DESCRIPCION_UNIDAD`: `Unidad`
- API `stock[]`: `ID_BODEGA=01`, `CANTIDAD=408.371`
- Supabase `system_stock`: `408.371`
- `delta_backend`: `0`

## Top outliers detectados

| BD | SKU | Producto | Unidad API | Stock |
|---|---:|---|---|---:|
| 02 | 2301005 | ARROZ BOLUGA X 500 GR | Unidad | 1.031.583,86 |
| 01 | 908008 | CEPILLO ADULTO ECONOMICO UND | Unidad | 600.240 |
| 02 | 2302031 | AZUCAR LUCERNA DE BULTO X LB | Unidad | 408.371 |
| 02 | 2302030 | AZUCAR LA CABANA DE BULTO X LB | Unidad | 295.879,25 |
| 02 | 202066 | DONA GALLINA X UND | Unidad | 190.169 |
| 02 | 2201033 | FRUTINO X UND | Unidad | 143.518 |
| 02 | 2303037 | SAL REFISAL X 500G | Unidad | 128.843,5 |
| 02 | 2301017 | ARROZ ROA X 500G | Unidad | 114.964 |

## Hallazgo de diseno

Aunque `DESCRIPCION_UNIDAD` dice `Unidad`, las cantidades de algunos productos parecen estar en otra escala o representar otra unidad comercial:

- gramos,
- libras,
- arrobas,
- bultos fraccionados,
- unidades internas de kardex,
- o una existencia corrupta/descargada incorrectamente en Millenium.

Fast Order no tiene, hoy, informacion suficiente para convertir automaticamente esos valores sin una tabla de equivalencias confiable. Convertir por heuristica desde la descripcion seria riesgoso.

## Recomendacion

1. No presentar el KPI agregado como "unidades fisicas totales" mientras existan estos outliers. Mostrarlo por base y con disclosure de "stock segun unidad ERP".
2. Mantener los outliers marcados con `needs_review` y excluirlos de KPIs agregados donde puedan contaminar decisiones.
3. Pedir a Ricardo/Camilo validar en Millenium los SKUs anteriores: unidad de compra, unidad de inventario/kardex, equivalencia y existencia por bodega.
4. Crear una tabla futura de equivalencias/mapeos (`inventory_unit_conversions` o similar) solo despues de confirmar la semantica real del ERP.
5. Usar `scripts/audit-stock-units.mjs` como evidencia repetible antes/despues de cada correccion en Millenium.

## Herramienta de interpretacion

Se agrego `scripts/interpret-stock-units.mjs` para convertir el stock crudo en escenarios de conversacion:

```bash
node scripts/interpret-stock-units.mjs arroz azucar azúcar
```

Ejemplos de lectura:

| BD | SKU | Producto | Stock crudo | Si fueran gramos | Si fueran libras |
|---|---:|---|---:|---:|---:|
| 02 | 2301005 | ARROZ BOLUGA X 500 GR | 1.031.583,86 | 2.274,25 lb / 90,97 arrobas / 2.063 paquetes de 500g | 41.263 arrobas |
| 02 | 2302031 | AZUCAR LUCERNA DE BULTO X LB | 408.371 | 900,3 lb / 36,01 arrobas | 16.334,84 arrobas |
| 02 | 2302030 | AZUCAR LA CABANA DE BULTO X LB | 295.879,25 | 652,3 lb / 26,09 arrobas | 11.835,17 arrobas |

En los tres casos, la hipotesis "stock crudo = gramos" produce magnitudes humanas y la hipotesis "stock crudo = libras" produce magnitudes exageradas. Esto no prueba la unidad real, pero es una pista fuerte para validar con el personal que maneja inventario.

## Plan de accion con Camilo / inventario

1. Seleccionar una muestra corta de SKUs criticos: arroz, azucar, sal y cualquier producto con `needs_review`.
2. Revisar fisicamente una referencia por vez y comparar contra tres lecturas: dato ERP crudo, interpretacion como gramos y equivalencia en arrobas/paquetes.
3. Confirmar con el equipo como se registra realmente cada producto en Millenium: unidad de inventario, unidad de compra, equivalencia de bulto/arroba/libra/paquete y bodega.
4. Separar hallazgos en dos grupos:
   - Configuracion correcta pero mal presentada por la API/app: crear equivalencia de visualizacion en Fast Order.
   - Mala practica o dato errado en Millenium: corregir el producto en el ERP y re-sincronizar.
5. Definir una regla de carga futura: ningun producto nuevo entra sin unidad base, presentacion comercial y equivalencia de compra/despacho.
6. Despues de validar suficientes casos, implementar una tabla persistente de equivalencias confirmadas por SKU/base, sin alterar el dato bruto.
