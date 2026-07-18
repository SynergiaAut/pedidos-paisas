# Lecciones aprendidas

Registro vivo. Agregar al cierre de cada sesión significativa.

## Sesión 2026-07-11 (integración API 2BD + módulo inventario)

**Integración con terceros**
1. **El contrato OpenAPI mentía**: el payload real de productos venía anidado (`{producto:{...}}`) y con campos distintos a los documentados. Regla: *probar el endpoint real y mirar los bytes antes de escribir un solo mapeo* (por eso existe `scripts/smoke-flex-crm.mjs`).
2. **Encoding**: la API declara UTF-8 pero envía windows-1252 ("ALI◆OS"). En vez de esperar al proveedor, el cliente decodifica con fallback — y si el proveedor lo corrige, el fallback deja de activarse solo.
3. **La latencia del proveedor es variable** (12–34 s, con timeouts). Todo consumo debe tener timeout generoso, reintento y tolerancia a fallo parcial por base.
4. Los catálogos de ERP traen ítems no-físicos (fletes/servicios como DOMICILIO). Detectarlos (`is_service`) y excluirlos de inventario evita totales inflados y descuadres falsos.

**Supabase / datos**
5. **Tablas creadas a mano en el dashboard son minas**: `inventory_master` traía `item_id NOT NULL` y un unique legacy `(db_source, item_id)` que nadie recordaba. Costó 3 iteraciones de sync. Regla: todo cambio de esquema por migración versionada; hacer `supabase db pull` como baseline (deuda A4, sigue pendiente).
6. **`physical_stock = 0` por defecto ≠ "sin contar"**: los defaults numéricos generan métricas falsas (661 descuadres fantasma). NULL tiene significado.
7. **PostgREST limita a 1000 filas por request** en silencio: paginar siempre que la tabla pueda crecer.
8. **RLS expone los clientes duplicados**: la app tenía dos clientes browser (uno plano sin sesión, uno SSR con cookies). Con tablas públicas nadie lo nota; al activar RLS, el cliente sin sesión recibe 0 filas *sin error*. Regla: un único cliente browser (`lib/supabase.ts` ahora usa `createBrowserClient`).
9. Jobs del sistema escriben con `service_role` **solo server-side** y con su propia autorización (`x-sync-secret`); las tablas quedan cerradas para el API público.

**Frontend**
10. `color-scheme: dark` global: los controles nativos (`<select>`, scrollbars) no heredan Tailwind y quedaban blanco-sobre-blanco.
11. Keys de React sobre columnas nullable (`item_id`) = bugs silenciosos; usar la clave natural (`sku+db_source`).

**Proceso**
12. Validar por capas ahorra horas: smoke script (API sola) → endpoint (app) → UI. Cada fallo se ubicó en minutos porque la capa anterior ya estaba verificada.
13. El middleware protegía solo 2 rutas — la seguridad "funcionaba" porque las tablas eran públicas. Al cerrar una capa se revelan los huecos de la otra: auditar en conjunto.
14. WhatsApp no es memoria de proyecto: los acuerdos con Ricardo ahora se registran en `docs/reuniones/`.

## Sesión 2026-07-12/13 (conteo móvil, dashboard de consolidados, confiabilidad de datos, reconciliación)

**Proceso / metodología SDD**
1. **Un skill sin versionar es un skill perdido**: `/startcycle` (el comando que arranca el pipeline SDD en Antigravity) dejó de reconocerse porque nunca se había commiteado — vivía solo en el filesystem local. Regla: `.agent/skills/` se commitea igual que cualquier otro artefacto de proceso; no es "configuración de IDE descartable".
2. **El usuario probando en producción real encuentra lo que ningún test automatizado encuentra**: casi todos los bugs de esta sesión (Realtime que no actualizaba, unidad de medida faltante, TopBar visible en vista pública, stat "Conteos Pendientes" desactualizado, cifras de valorización que "no cuadraban") salieron de Johnathan usando la feature de verdad, no de QA interno. Regla: después de que Antigravity marca una tarea como completa, hay una fase obligatoria de "probar en el flujo real" antes de darla por cerrada.

**Datos de terceros (ERP Milenium)**
3. **Nunca confiar ciegamente en campos financieros de un ERP externo**: `cost_avg` traía valores corruptos de escala absurda (billones de COP en un six-pack de cerveza) directo desde Milenium. Cualquier agregación financiera sobre datos de terceros necesita guardrails de rango sensato desde el diseño inicial, no como parche posterior al primer susto.
4. **Un solo byte mal codificado puede dañar un lote entero**: el fallback de encoding anterior re-decodificaba TODA la respuesta de 2.145 productos como windows-1252 si un solo producto traía un byte inválido, arruinando la "Ñ" de productos que sí venían bien. Regla: reparar encoding por campo/registro individual, nunca "si algo se rompe, re-decodificar todo".
5. **El contrato documentado (OpenAPI) puede no reflejar las limitaciones reales de datos**: se asumió que se podría "netear ventas reales" contra el descuadre, pero los endpoints de pedidos/facturas de Milenium solo devuelven un `total` de cabecera, sin detalle de línea por SKU. Verificar la granularidad real disponible *antes* de diseñar una feature que dependa de ella, y documentar el hueco como pendiente con el proveedor en vez de descubrirlo a medio desarrollo.
6. **Datos "cacheados" de un ERP externo son inherentemente eventual-consistency**: `system_stock` es una foto del último sync, no el stock real en vivo. Si el conteo físico ocurre en horario de venta activa, la foto desactualizada puede reportar como "pérdida" unidades que en realidad se vendieron legítimamente. Mitigado con sync más frecuente (cron 15 min) + una reconciliación puntual contra el dato más fresco en el momento de cierre de sesión — pero sigue siendo una aproximación (el ERP no expone detalle de línea para atribuir el cambio a una venta específica).

**Higiene de datos de prueba**
7. **Los datos de prueba sembrados durante el desarrollo no deben llegar nunca a una pantalla que el dueño del negocio va a mirar como "real"**: 2 sesiones de conteo de prueba quedaron en la base de datos y contaminaron ~6.5% de las cifras de descuadre mostradas en el dashboard, generando dudas legítimas sobre la confiabilidad de todo el sistema. Regla: limpiar datos de prueba antes de considerar una feature lista para demo, o marcarlos de forma que se excluyan por defecto de cualquier vista analítica.

## Sesión 2026-07-15 (optimización analítica, zona horaria y vistas materializadas)

**Datos y Servidor**
1. **La zona horaria local del servidor es una trampa silenciosa:** El desfase de hora UTC del contenedor de producción causaba que las peticiones incrementales de facturación solicitaran al ERP fechas futuras o desfasadas (obteniendo `0 facturas` en el sync). Forzar la hora de Colombia (`America/Bogota`) usando `Intl.DateTimeFormat` de forma estricta previene desalineaciones.
2. **Ejes temporales en Recharts sin línea base:** Si los snapshots intradía se registran a mitad del día, graficar solo los snapshots existentes causa que la curva de acumulados se vea plana de extremo a extremo, y que los deltas inicien con picos erráticos de $0 a millones al asumir que el primer punto partió de cero. Generar una **línea base continua de 24 horas desde las 00:00** rellenando vacíos con el último valor acumulado conocido soluciona esto de raíz.

**Base de Datos (Supabase / Postgres)**
3. **Vistas Materializadas para Analítica OLAP:** Hacer agregaciones SQL en caliente sobre miles de filas transaccionales (`sales_lines`) degrada el rendimiento de Supabase a mediano plazo. Una vista materializada (`mv_daily_sales_aggregation`) precalcula las ventas diarias por SKU y clasificación, reduciendo el tiempo de respuesta analítica de segundos a **2.1 ms**.
4. **Refresco concurrente y Unique Indexes:** Para refrescar una vista materializada de forma concurrente sin bloquear lecturas de usuarios (`REFRESH MATERIALIZED VIEW CONCURRENTLY`), la vista **debe contar con un índice único**. Agrupar en la vista por columnas con variaciones menores (como la descripción del producto) arruina la unicidad del índice; la agregación debe agrupar estrictamente por las claves naturales de negocio (`fecha`, `sku`, `db_source`, `id_clasificacion`, `id_marca`) y usar funciones como `min()` para las columnas descriptivas.
5. **Automatización del Refresco por RPC:** Exponer el refresco de la vista materializada mediante una función RPC en PostgreSQL con `security definer` permite invocarla de forma segura desde Server Actions de Node.js al finalizar la sincronización de facturas, manteniendo los datos listos de forma automatizada y sin costos extra.

**Separación de Dominios Analíticos**
6. **Pedidos vs. Facturación:** En FastOrder, un "Pedido" (`orders`) es una entidad logística de preventa/despacho consolidada manualmente por asesores, mientras que una "Factura" (`sales_lines`) es la venta bruta física en mostrador del ERP Millenium. Esta distinción hace que las dos analíticas sean necesarias y complementarias: `/analytics` (preventa/despachos) y `/inventario -> Comportamiento` (facturación total del ERP).

