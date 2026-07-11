# Módulo: Inventario (fase activa)

**Problema:** Camilo necesita cuadrar inventario unificado de las 2 bases de Milenium (GRANES + FISCAL) sin entrar al ERP. Es la necesidad más urgente del cliente y el módulo bloqueado por la integración.

## Estado

UI construida y funcionando contra Supabase; **falta poblarla**: el sync desde la API Flex CRM con 2 credenciales está especificado en `.spec/integracion-api-2bd/` (esperando que Ricardo cree el usuario de BD2).

## Componentes

- `src/app/inventario/page.tsx` — dashboard con stats.
- `src/components/inventory/UnifiedStockTable.tsx` — tabla unificada, realtime sobre `inventory_master`, filtro por `db_source` ('01'/'02'), búsqueda por description/sku/barcode.
- `src/components/inventory/CyclicCountWizard.tsx` — conteo cíclico: sesiones (`inventory_sessions`) y conteos (`inventory_counts`) contra el stock teórico.

## Datos

- `inventory_master`: catálogo/stock réplica de Milenium. Campos usados por la UI: `sku`, `barcode`, `description`, `db_source`, stock, precio. ⚠️ Sin migración versionada (creada en dashboard) — ver deuda A4.
- `inventory_counts`, `inventory_sessions`: capa propia de conteo físico.

## Diseño del sync (resumen del spec)

`FlexCrmClient('01')` y `FlexCrmClient('02')` → `GET productos` → upsert idempotente en `inventory_master` por `(sku, db_source)` → marcar `synced_at`. Ejecutado server-side (route handler protegido + cron). Milenium es fuente de verdad del stock teórico; los conteos locales nunca lo sobreescriben — generan diferencias para ajuste manual en el ERP.

## Preguntas abiertas (para Ricardo)

- ¿Existencias por bodega (`BODEGA`) o solo total? ¿Incluye costo?
- ¿Frecuencia de refresco razonable sin castigar su servidor? (propuesta: cada 15 min + botón manual)
