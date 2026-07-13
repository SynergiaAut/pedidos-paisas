# Roadmap — Fast Order × API Milenium

> Tareas y oportunidades priorizadas por valor para el negocio de Los Paisas.
> Regla SDD: nada de la sección "Fases" se codifica sin su spec en `.spec/<feature>/`.
> Actualizado: 2026-07-11 (día de la validación de la integración).

## 🔥 Inmediato (desbloqueos, sin desarrollo)

| # | Tarea | Depende de | Valor |
|---|---|---|---|
| I-1 | Credenciales BD2 (usuario FISCAL en Flex CRM) → `.env.local` → sync `all` | Ricardo | Inventario completo de las 2 empresas — cierra la promesa a Camilo |
| I-2 | Rotar clave SSH del túnel (expuesta en historial git — auditoría S1) | Ricardo (5 min juntos) | Seguridad |
| I-3 | Respuestas de Ricardo: precio de venta en payload, UTF-8, paginación/filtro incremental | Ricardo | Habilita F-1, F-4 y el cron |
| I-4 | Cron del sync (cada 15 min o lo acordado) + monitor del health | I-3 (latencia) | Inventario siempre fresco sin botón |

## Fase A — Conciliación de facturas (el premio gordo) 💰

**Idea:** job diario/horario que trae `/crm/all/invoice` del día y lo cruza contra los pedidos capturados en Fast Order.

**Valor de negocio:** hoy el cuadre depende de que el cajero capture bien cada factura. Con esto se detecta automáticamente: facturas de Milenium que nadie capturó (pedidos fantasma / plata sin rastrear), valores digitados distintos al facturado, y pedidos sin factura. El cuadre diario pasa de control manual a conciliación contra el ERP.

**Pasos:** (1) extender `smoke-flex-crm.mjs` para ver el payload real de facturas — el contrato ya nos mintió una vez; (2) spec `.spec/conciliacion-facturas/`; (3) tabla `invoice_reconciliation` + vista en Cuadre con semáforo del día.

## Fase B — Conteo móvil por link (TASK-011, metodología original) 📱

Cada inventario genera un link/token para que los bodegueros cuenten desde el celular (patrón ya probado con el registro QR). Sesión expira al cerrar el conteo o a las 24h; escritura solo vía RPC insert-only, RLS cerrado en `inventory_sessions`/`inventory_counts` (cierra deuda técnica #2 para estas tablas). **Valor:** conteos reales en bodega sin computador, varios contadores en paralelo — el conteo cíclico se vuelve práctica semanal y no evento. **No depende de BD2/Ricardo — se puede ejecutar ya.** Spec + plan + tasks completos: `.spec/conteo-movil/` (2026-07-12), pendiente de implementación en Antigravity.

## Fase C — Mostrador inteligente 🛒

1. **Cartera en captura:** al seleccionar cliente, mostrar su deuda (`/crm/one/debit`): "⚠️ debe $840.000, vencido hace 15 días". El cajero decide informado — impacto directo en recuperación de cartera.
2. **Validación de factura contra ERP:** el Magic Paste verifica número y valor contra `/crm/one/order` — se acaban los errores de digitación.
3. **Existencias en la búsqueda de productos:** `UnifiedProductSearch` leyendo `inventory_master` — no más vender sin stock.
4. **Vincular `clients` ↔ `TERCERO`** (por NIT/teléfono): historial ERP + RFM propio en una sola ficha.

## Fase D — Inteligencia de inventario 📊

Requiere I-3 (precio de venta) y BD2:

1. **Margen por producto** (`precio − cost_avg`): ranking de rentabilidad real, no solo ventas.
2. **Alertas de stock bajo** por clasificación → lista de compras sugerida para el proveedor.
3. **Rotación:** cruzar ventas (facturas API) con stock → detectar capital muerto en estantería.
4. **Valorización del inventario** (stock × costo) por bodega y por empresa — el número que todo dueño quiere ver al cierre.

## Fase E — Tiempo real y escritura (depende de desarrollo de Ricardo)

1. **Push por evento** (pedido/factura → webhook a Supabase): elimina el polling, habilita despacho reactivo. Ricardo dijo tenerlo listo el 12-may — retomar.
2. **POST de clientes** (registro QR → `TERCERO` con `CLIENTE='SI'`): el cliente se registra una vez y existe en ambos sistemas.

## Fase F — Visión: canal WhatsApp 🤖

Con catálogo, existencias y clientes ya en Supabase, un bot de WhatsApp (sinergia con la plataforma BotFlow de Synerg-IA) podría tomar pedidos, informar disponibilidad y estado del domicilio. Gran valor, gran alcance — solo después de A–C estables.

## 🧱 Deuda técnica (intercalar, no posponer indefinidamente)

1. Baseline de migraciones (`supabase db pull`) y borrar SQL sueltos — deuda A4, nos costó 3 iteraciones hoy.
2. RLS de las tablas restantes (`orders`, `clients`, `invoice_events`, `inventory_counts/sessions`) — S2.
3. Tests del parser Magic Paste con facturas reales (el código más frágil del sistema).
4. Migrar `middleware.ts` → convención `proxy` (deprecada en Next 16).
5. CI (lint + tsc + tests) cuando el repo tenga remoto.
6. Cambiar contraseña `masterkey` del Firebird del cliente (coordinar con Ricardo).

## Orden sugerido

**I-1 a I-4** (desbloqueos) → **A** (conciliación: máximo valor/esfuerzo) → **B** (conteo móvil: promesa metodológica) → **C1–C3** (mostrador) → **D** → **E** → **F**, intercalando 1 ítem de deuda técnica por fase.
