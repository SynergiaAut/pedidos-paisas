# Spec: Integración API Flex CRM con 2 bases de datos

**Fase SDD:** Specification (borrador) → pendiente Clarification con Ricardo.
**Origen:** reunión 2026-07-11 — Ricardo propone un usuario de API por base de datos.

## Problema que resuelve

El módulo de inventario está construido pero vacío: no hay flujo de datos desde las 2 bases de Milenium (GRANES '01' y FISCAL '02') hacia `inventory_master`. Camilo necesita cuadrar inventario ya. El cliente paga la API desde abril sin beneficio visible.

## Usuarios objetivo

- **Camilo / Alejandra:** ver stock unificado de ambas bases y hacer conteos cíclicos contra el teórico.
- **Cajeros:** buscar productos con existencias reales al capturar pedidos (`UnifiedProductSearch`).

## Historias de usuario

- Como administrador, quiero ver en una sola tabla el inventario de las 2 empresas con su origen identificado, para cuadrar sin entrar dos veces a Milenium.
- Como administrador, quiero que el stock se refresque solo (y con botón manual), para confiar en lo que veo.
- Como cajero, quiero buscar un producto y ver existencia y precio actuales, para no vender sin stock.

## Criterios de aceptación

- [ ] `flex-crm.ts` soporta N credenciales; existen instancias '01' y '02' con renovación de token independiente.
- [ ] Todo registro importado lleva `db_source`; el upsert es idempotente por `(sku, db_source)`.
- [ ] Prueba de aceptación BD2: `GET /crm/productos` con token '02' devuelve catálogo distinto al de '01'.
- [ ] Sync ejecutable por route handler protegido (no accesible anónimamente) + programable (cron cada 15 min, configurable).
- [ ] Si una BD falla, la otra sincroniza igual; el error queda registrado con contexto (endpoint, db_source, mensaje).
- [ ] `inventory_master` muestra `synced_at` visible en la UI ("actualizado hace X min").
- [ ] Tests: mapeo producto-API → fila `inventory_master` (casos: producto nuevo, actualización de stock/precio, producto desactivado, payload malformado).

## Fuera de alcance (fase 2)

Escritura hacia Milenium (clientes/pedidos), push por evento desde Milenium, existencias históricas/KARDEX, cartera y facturas.

## Clarifications

**Resueltas por prueba real contra la API (2026-07-11, BD1):**
- Volumen BD1: 2.145 productos. Sin paginación aparente (todo en una respuesta).
- ✅ Existencias vienen **por bodega**: `stock: [{CANTIDAD, ID_BODEGA}]`.
- ✅ Viene `COSTO_PROMEDIO`, clasificación, marca, unidad, referencia y proveedor.
- ⚠️ El payload real difiere del OpenAPI: elementos anidados en `{producto:{...}}` — ya manejado en `normalizeProduct()`.

**Pendientes (preguntar a Ricardo):**
1. **Precio de venta no viene** en el payload de productos. ¿Endpoint de precios (`PRECIO_ITEM`) o lo agregan al payload?
2. **Encoding roto** en caracteres latinos ("ALI◆OS" ≠ "ALIÑOS"): ¿pueden servir la respuesta en UTF-8?
3. **Latencia 12–34 s** para el catálogo completo (con timeouts intermitentes): ¿paginación, filtro incremental (modificados desde fecha) o ventana horaria sugerida?
4. ¿El usuario BD2 usa el mismo flujo de activación (código al correo, 5 min)? ¿A qué correo?
5. ¿Cómo reporta la API productos inactivos/eliminados? (para no dejar zombies en `inventory_master`)
6. ¿`ID_BODEGA: null` con `CANTIDAD: 0` significa "sin stock en ninguna bodega" o "ítem sin control de inventario" (ej. fletes/servicios como DOMICILIO)?

## Siguiente paso

Al resolver las clarifications → escribir `plan.md` (refactor `flex-crm.ts` a factoría, route `api/milenium/sync-inventario`, migración formal de `inventory_master` con unique `(sku, db_source)` y `synced_at`) → `tasks.md` atómicas → implementación en Antigravity vía dev-handoff.
