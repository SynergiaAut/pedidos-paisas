# Plan: Interpretacion de unidades de inventario

## Enfoque

1. Crear una utilidad pura reutilizable en TypeScript para calcular escenarios desde `description`, `system_stock` y `unit`.
2. Mostrar en el catalogo un selector global "Ver stock como" para cambiar la unidad interpretada sin tocar datos.
3. Agregar columna "Interpretacion" junto a "Stock Sistema".
4. Marcar productos con stock sospechoso o con lectura de unidad potencialmente ambigua.
5. Dejar el dato bruto visible siempre.

## Futuro

Despues de validacion con Camilo:

- Crear tabla `inventory_unit_conversions`.
- Permitir confirmar equivalencias por SKU/base.
- Generar reporte de correcciones recomendadas para Millenium.

