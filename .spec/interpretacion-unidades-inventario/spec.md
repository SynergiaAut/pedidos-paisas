# Spec: Interpretacion de unidades de inventario

Fecha: 2026-07-17

## Contexto

Al presentar inventario al cliente se detectaron stocks fuera de escala en productos como arroz y azucar. La auditoria `docs/auditorias/2026-07-17-auditoria-stock-unidades.md` confirma que Fast Order guarda fielmente el valor crudo de Flex CRM/Millenium en `inventory_master.system_stock`.

El problema probable es semantica de unidades en Millenium: algunos productos aparecen como `Unidad`, pero sus cantidades parecen representar gramos u otra unidad interna de kardex.

## Objetivo

Agregar una capa de interpretacion visual en el catalogo de inventario que permita comparar el stock bruto del ERP contra escenarios plausibles:

- unidades crudas,
- gramos,
- libras,
- arrobas,
- paquetes segun presentacion detectada en la descripcion.

## No objetivos

- No modificar el dato bruto del ERP.
- No escribir conversiones confirmadas en base de datos en esta fase.
- No corregir automaticamente productos en Millenium.

## Reglas

- `system_stock` se conserva como dato bronce.
- Toda conversion se etiqueta como interpretacion o escenario.
- Si no hay presentacion detectable, no se inventa cantidad de paquetes.
- La UI debe servir para conversacion con Camilo/inventario, no como verdad definitiva.

