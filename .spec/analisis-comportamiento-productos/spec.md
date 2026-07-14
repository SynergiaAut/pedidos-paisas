# Spec: Pestaña "Comportamiento de productos" (módulo Inventario)

**Fase SDD:** Specification → Clarification resuelta en esta sesión → lista para `plan.md`.
**Origen:** requerimiento del cliente (Camilo) — agregar en `/inventario` una pestaña de análisis del comportamiento de los productos.
**Por qué ahora:** la validación de la API (2026-07-13) confirmó que las facturas traen **detalle de línea real** (`ID_ITEM`, `CANTIDAD`, `PRECIO`, `COSTO_KARDEX`, `MARGEN`). Eso habilita, por primera vez, análisis de **rotación y rentabilidad reales** por producto — antes imposible porque el catálogo no exponía precio de venta ni movimiento.

## Problema que resuelve

Hoy `/inventario` tiene dos pestañas: **Catálogo** (`UnifiedStockTable`) y **Análisis** (`InventoryAnalysisTab`: cobertura, tendencias de descuadres, historial de sesiones, ranking de productos problemáticos). No hay forma de responder preguntas de negocio como: ¿qué se vende y qué no rota?, ¿qué productos dejan más/menos margen?, ¿qué ítems tienen fugas recurrentes y cuánto cuestan? El dueño necesita ver el **comportamiento de cada producto** para decidir qué comprar, qué impulsar y qué descontinuar.

## Alcance (decidido con el cliente)

Analizar tres dimensiones: **Rotación y ventas**, **Rentabilidad / márgenes** y **Descuadres y mermas**. Fuente de datos: **sincronizar las ventas del ERP** (líneas de factura) a una tabla propia. Formato: **agregado (ranking + gráficos) y ficha por producto (drill-down)**. *(Quiebres/reposición queda fuera de esta fase.)*

## Usuarios objetivo

- **Camilo / administración:** abren la pestaña, ven qué rota y qué deja plata, buscan un producto y ven su historia. Solo lectura.

## Historias de usuario

- Como dueño, quiero ver el **top y el fondo de ventas** (qué se vende y qué no rota) en un período, para decidir compras y promociones.
- Como dueño, quiero ver el **margen por producto** (y los de margen bajo/negativo), para dejar de perder plata en ciertos ítems.
- Como dueño, quiero ver los **productos con descuadres/mermas recurrentes** y su costo, para atacar fugas.
- Como dueño, quiero **buscar un producto** y ver su comportamiento individual (ventas en el tiempo, stock actual, costo, margen, descuadres), para decidir sobre ese ítem puntual.

## Arquitectura (respetando la constitución)

Dos partes, **aditivas** (no tocan Catálogo ni la pestaña Análisis actual):

1. **Sync de ventas (server-side).** Reusa `getInvoices`/`normalizeInvoice` de `src/lib/flex-crm.ts` (única puerta a la API, Art. 2). Un route handler (`src/app/api/milenium/sync-ventas/`) trae las líneas de factura por rango de fechas de BD1 y BD2 y hace **upsert idempotente** a una tabla nueva `sales_lines`, etiquetando `db_source`. Corre fuera del request del usuario: **backfill** histórico (por lotes de días/semanas, para no chocar con la latencia ~13 s/mes) + **incremental** periódico (vía `instrumentation.ts` + `node-cron`, como el sync de inventario; frecuencia menor, ej. cada hora o al cierre del día).
2. **Pestaña "Comportamiento".** Tercera pestaña en `/inventario` (`activeTab: 'catalog' | 'analysis' | 'behavior'`), con vista agregada (Recharts + tablas) y ficha por producto. Consulta `sales_lines` cruzada con `inventory_master` (stock/costo/clasificación) y con `inventory_sessions`/`inventory_counts` (descuadres).

## Datos (borrador para `plan.md`)

Tabla nueva `sales_lines` (línea de venta del ERP):
- `id`, `db_source`, `tipodoc`, `numero`, `fecha` (date), `sku` (=`ID_ITEM`), `descripcion`, `id_clasificacion`, `id_marca`, `id_bodega`, `id_vendedor`, `cantidad` numeric, `precio` numeric, `total` numeric, `costo_unit` numeric (=`COSTO_KARDEX`), `total_costo` numeric, `margen` numeric, `synced_at`.
- **Idempotencia:** clave natural `(db_source, tipodoc, numero, sku)`; si un SKU se repite en una factura, agregar cantidad al ingerir. Alternativa: reemplazo por factura (borrar líneas de esa factura y reinsertar) en cada sync del rango.
- Índices: `(sku)`, `(db_source, fecha)`, `(fecha)`.
- **RLS habilitado**, acceso solo a usuarios autenticados de administración (datos de ventas/márgenes son sensibles; Art. 3).

## Métricas

- **Rotación/ventas:** unidades vendidas por período y por SKU; velocidad (unid/día); **dead stock** = SKUs con `system_stock > 0` y 0 ventas en el período; slow movers (velocidad baja). Cruce `sales_lines` × `inventory_master`.
- **Rentabilidad:** margen unitario = `precio − costo_unit`; margen % = `margen/precio`; contribución = `sum(total − total_costo)`. Top/bottom margen y **márgenes negativos**.
- **Descuadres/mermas:** frecuencia y costo por SKU desde `inventory_counts`/`inventory_sessions` (reusa la lógica del ranking ya existente; enlazar, no duplicar).

## Criterios de aceptación

- [ ] Nueva pestaña **"Comportamiento"** en `/inventario` junto a Catálogo y Análisis, sin alterar el comportamiento de esas dos.
- [ ] Existe `sales_lines` (migración con RLS + índices) poblada por el sync de ventas.
- [ ] El sync de ventas usa **solo** `flex-crm.ts`, etiqueta `db_source`, es **idempotente** y corre **server-side**; registra errores con contexto y **degrada** si BD2 no tiene credenciales (Art. 2/4).
- [ ] Backfill histórico por lotes (rango configurable, ej. últimos 3–6 meses) **sin** bloquear la UI, e **incremental** programado.
- [ ] Vista agregada: ranking de **más/menos vendidos**, **dead stock**, **top/bottom margen** y **márgenes negativos**, con gráficos (Recharts) y filtros por período y clasificación.
- [ ] **Ficha por producto** (drill-down): buscar un SKU y ver ventas en el tiempo, stock actual (`system_stock`/`physical_stock`), costo, margen y su historial de descuadres.
- [ ] **Excluir/marcar** los SKUs con `cost_avg` corrupto conocidos del ERP (2202007, 701042, 606042) del cálculo de márgenes, con disclosure — igual que en Valorización.
- [ ] La UI **no** expone datos sensibles a roles no autorizados; márgenes/costos solo para administración.
- [ ] Mapeo factura→`sales_lines` con **tests** usando la muestra real (`scripts/validacion-pedidos-MUESTRA.json`) antes de merge (Art. 4).

## Fuera de alcance (esta fase)

- **Quiebres de stock y sugerencia de reposición** (queda para una fase futura; el cliente no lo pidió ahora).
- **Pronóstico de demanda / ML.**
- **BD2 en ejecución:** se codifica para 2 bases, pero corre **BD1-only** hasta que Ricardo entregue credenciales de BD2 (las ventas de BD2 no entran hasta entonces).
- Reescribir o mover la pestaña **Análisis** actual (se mantiene tal cual; "Comportamiento" es complementaria).

## Clarifications (decisiones de esta sesión)

1. **Dimensiones** → Rotación/ventas + Rentabilidad/márgenes + Descuadres/mermas. (Quiebres/reposición: fuera.)
2. **Fuente de datos** → **Sincronizar ventas del ERP** a `sales_lines` (no on-the-fly contra la API, por latencia/volumen ~4.738 facturas/mes).
3. **Formato** → **Ambos**: agregado (ranking + gráficos) y ficha por producto (drill-down).
4. **Reúso** → aprovechar `getInvoices`/`normalizeInvoice` ya construidos y el patrón de sync + cron del inventario; no crear una segunda puerta a la API.
5. **Sensibilidad/calidad** → RLS admin-only sobre ventas; excluir outliers de costo conocidos; degradar si BD2 falta.

## Dependencias y pendientes

- **BD2:** credenciales de Ricardo para incluir sus ventas (ya en `.spec/integracion-api-2bd/`).
- **Rendimiento:** definir la ventana del backfill y la frecuencia del incremental para no saturar la API/túnel.

## Siguiente paso

`plan.md` con: migración `sales_lines` (RLS + índices), `getInvoices`→mapeo a `sales_lines`, route handler `sync-ventas` (backfill por lotes + incremental) e integración en `instrumentation.ts`, consultas/vistas de agregación (SQL o RPC), componentes de la pestaña `BehaviorTab` (agregado + ficha, Recharts), y `tasks.md` atómico → handoff a Antigravity. **Regla transversal:** Catálogo y Análisis quedan intactos.
