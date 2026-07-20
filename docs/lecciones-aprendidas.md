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

## Sesión 2026-07-18 (monitoreo intradía de ventas y calidad de snapshots)

**Analítica en vivo**
1. **Un total diario real no equivale a comportamiento intradía real:** si la API del ERP solo entrega `FECHA` y no hora de factura, el histórico por día puede ser correcto aunque la curva por horarios dependa exclusivamente de snapshots tomados por Fast Order.
2. **La regla correcta de franjas es simple, pero exige acumulados frescos:** `venta acumulada snapshot actual - venta acumulada snapshot anterior = venta de la franja`. Si antes de cada snapshot no se sincroniza primero el día actual desde Flex CRM, la diferencia queda en cero aunque el granero siga facturando.
3. **Los snapshots de ventas deben ser monotónicos durante el día:** un acumulado de ventas no debe bajar. Si baja, hay dato parcial u obsoleto, por ejemplo una instancia vieja escribiendo snapshots con lógica anterior. La UI debe ignorar retrocesos y usar el mayor acumulado visto por base para evitar gráficas engañosas.
4. **Evitar procesos viejos escribiendo datos de control:** tener varias instancias `next dev` corriendo en paralelo puede duplicar crons y producir snapshots contradictorios. Para monitoreo en vivo, reiniciar limpio y garantizar una sola instancia activa es parte de la operación.
5. **El primer snapshot con ventas no representa una franja normal si el monitor arrancó tarde:** ese salto es un "acumulado inicial", no ventas de cinco minutos. La UI debe etiquetarlo como corte inicial y graficar las franjas reales desde el siguiente incremento.
6. **Un endpoint operativo debe ejecutar el ciclo completo:** para monitoreo confiable, el job no es solo "guardar snapshot"; es `sincronizar ventas de hoy -> refrescar agregados -> guardar snapshot`. Se agregó `snapshot: true` al endpoint de sync de ventas para poder probar y programar ese ciclo completo de forma explícita.

## SesiÃ³n 2026-07-18 (pedidos multi-borrador y cuadre operativo)

**Pedidos**
1. **El usuario de login del ERP no siempre es el mejor discriminador operativo:** Milena trabaja con usuarios `AUXILIAR`/`PEDIDOS`, pero la API de facturas expone de forma confiable `ID_VENDEDOR` y `NOMBRE_VENDEDOR`. Para detectar su facturaciÃ³n, el vendedor (`1112223087`) es suficiente y mÃ¡s estable que perseguir el usuario interno de Millenium.
2. **Un flujo eficiente del negocio puede verse "desordenado" desde software lineal:** Milena atiende varios clientes a la vez en varias ventanas de Millenium. La interfaz debe modelar una mesa multi-pedido con borradores paralelos, no forzar un solo pedido activo.

**Cuadre**
3. **Cuadre de caja, despacho y vendedor son dominios distintos:** `orders` sirve para logÃ­stica/despacho; `sales_lines` sirve para facturaciÃ³n real del ERP; `daily_cash_closures` sirve para registrar el conteo operativo de caja. Mezclarlos en una sola lectura produce falsos faltantes o cifras difÃ­ciles de explicar.
4. **Un pedido pendiente no es faltante de caja:** el esperado del cierre debe sumar solo pedidos `ENTREGADO`/`PAGADO`; lo pendiente se muestra aparte como carga operativa, no como diferencia negativa.
## Sesion 2026-07-19 (usuarios, perfiles y desarrollo local)

**Operacion local**
1. **La UI local no siempre debe ejecutar jobs de produccion:** los crons de inventario, ventas y snapshots son correctos en servidor, pero en desarrollo pueden fallar por red o credenciales y confundir la validacion visual. `DISABLE_BACKGROUND_JOBS=true` permite levantar Next para trabajar interfaz sin tocar los ciclos automaticos.

**Perfiles**
2. **Roles operativos antes que roles genericos:** `admin`/`user` no describe el trabajo real del granero. Separar `pedidos`, `despacho`, `inventario`, `cuadre` y `analitica` prepara permisos claros sin romper usuarios heredados.
3. **Editar perfiles desde el browser es demasiado sensible:** la administracion de usuarios debe pasar por Server Actions con verificacion de admin y `service_role`, dejando la UI como capa de intencion y no como autoridad directa sobre la tabla `profiles`.
4. **Rol base y permisos granulares no son lo mismo:** el rol ayuda a clasificar el cargo operativo, pero los accesos reales deben poder ajustarse por persona. `profiles.app_permissions` permite que alguien de pedidos tenga CRM, o que cuadre tenga analitica, sin crear un rol nuevo por cada combinacion.

## Sesion 2026-07-20 (ADN visual FastOrder, logo oficial y login)

**Identidad visual**
1. **El logo oficial necesita una version UI recortada:** los PNG originales traen mucho margen interno; usarlos directo en la barra hace que el emblema se vea diminuto aunque el contenedor sea grande. Se genero `public/brand/fastorder-logo-horizontal-ui.png` para interfaces.
2. **El amarillo de marca debe ser acento, no superficie dominante:** en permisos, tarjetas repetidas y login, demasiado `brand` satura la pantalla. El ADN FastOrder se sostiene mejor con azul noche, bordes sobrios y amarillo reservado para acciones/jerarquia.
3. **Un login premium debe pertenecer al mismo sistema visual que la app:** el efecto de entrada no puede sentirse como demo aislado. `DottedSurface` se adapto a una paleta azul oscura, con glass transparente y puntos finos como textura, no como protagonista.
4. **Integrar componentes de 21st por copy-paste evita depender de claves en produccion:** las API keys no deben quedar en codigo ni docs. Cuando el componente es visual, versionarlo localmente en `src/components/ui` da control, auditoria y despliegue estable.
5. **Las marcas externas tambien deben adaptarse al entorno visual:** insertar un logo con su propio fondo lo hace parecer un sticker. Para pantallas dark/glass, conviene generar una version transparente o UI-safe del activo y dejar que respire sobre el fondo nativo de la tarjeta.
