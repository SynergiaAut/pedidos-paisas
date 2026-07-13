# Tasks: Conteo móvil por link (referencia: plan.md)

> Handoff: Claude/Cowork → Antigravity. Ninguna tarea depende de Ricardo/BD2 — se puede ejecutar completa ya.
> Antes de empezar: `list_tables` + `get_advisors` (MCP Supabase) sobre `inventory_sessions`/`inventory_counts` para confirmar que no hay policies manuales previas que choquen con TASK-M01.

## Bloque A — Base de datos

- [ ] **TASK-M01** Migración `supabase/migrations/014_conteo_movil.sql` (columnas nuevas en `inventory_sessions`/`inventory_counts`, RLS habilitado + policy `authenticated`, 3 funciones RPC, grants a `anon`/`authenticated` solo sobre las funciones). Verifica: `apply_migration` sin error; `select * from pg_policies where tablename in ('inventory_sessions','inventory_counts')` muestra las policies nuevas; `get_advisors` no reporta la tabla como desprotegida.
- [ ] **TASK-M02** Prueba manual de las 3 RPC vía `execute_sql` o SQL editor: sesión válida → `get_mobile_session_info` retorna `valid:true`; sesión con `status='completed'` → `valid:false, reason:'closed'`; `submit_mobile_count` con `is_service=true` rechaza; con cantidad negativa rechaza.

## Bloque B — Backend (Server Actions)

- [ ] **TASK-M03** `src/app/actions/mobile-count.ts`: `createMobileCountSession`, `closeMobileCountSession`, `getMobileSessionProgress` (autenticadas, mismo patrón que `src/app/actions/inventory.ts`). Verifica: crear sesión devuelve `{token, url}`; cerrar sesión cambia `status` a `completed` y el link deja de aceptar conteos (probar con TASK-M02).
- [ ] **TASK-M04** `src/app/conteo/[token]/actions.ts`: `getSessionInfo`, `getSessionItems`, `submitCount` (sin auth, cliente anon). Verifica: llamadas funcionan sin sesión de usuario iniciada (probar en incógnito).

## Bloque C — Frontend público (bodeguero)

- [ ] **TASK-M05** `src/app/conteo/[token]/layout.tsx` — layout público mobile-first (sin sidebar/nav del dashboard), estilo claro consistente con `src/app/registro/layout.tsx`.
- [ ] **TASK-M06** `src/app/conteo/[token]/page.tsx` — estados: cargando, inválido/cerrado/expirado (mensaje según `reason`), y activo. Captura de nombre una vez (`localStorage`), lista buscable de ítems, input numérico grande + guardar por fila con feedback ✓. Verifica manual: abrir el mismo link en 2 dispositivos/pestañas y contar ítems distintos en paralelo sin errores.
- [ ] **TASK-M07** `src/middleware.ts` — agregar `/conteo` a rutas públicas. Verifica: `/conteo/<token-valido>` accesible sin login; resto de rutas del dashboard siguen exigiendo sesión.

## Bloque D — Frontend admin (extensión del wizard)

- [ ] **TASK-M08** `src/components/inventory/CyclicCountWizard.tsx` — Paso 1: toggle "Desde este computador" vs "Conteo móvil (compartir link)". Rama móvil llama `createMobileCountSession` y pasa a un Paso 2B nuevo.
- [ ] **TASK-M09** Paso 2B: mostrar URL + botón "Copiar" + botón "Compartir" (`navigator.share()` con fallback a copiar) + barra de progreso vía Supabase Realtime sobre `inventory_counts` filtrado por `session_id` + botón "Cerrar conteo" (`closeMobileCountSession`) → Paso 3 existente.
- [ ] **TASK-M10** Fix de bug menor en el mismo componente: `item.category` → `item.classification` en la fila de conteo del Paso 2 (dato mostrado hoy sale vacío).

## Bloque E — QA

- [ ] **TASK-M11** `tests/mobile-count-rpc.test.mjs` (o suite SQL) cubriendo los casos del plan: token válido, sesión cerrada, sesión expirada, ítem servicio, cantidad negativa, dos inserciones concurrentes al mismo ítem.
- [ ] **TASK-M12** Prueba manual E2E con Camilo/Alejandra: crear conteo móvil real, compartir por WhatsApp, contar desde 2 celulares en paralelo, verificar progreso en vivo desde `/inventario`, cerrar y confirmar que el link ya no acepta más conteos.

## Bloque F — Cierre de documentación (al terminar)

- [ ] **TASK-M13** Actualizar `docs/modulos/inventario.md` (quitar la sección "⚠️ Desviación de la metodología original", documentar el flujo final) y la sección "Estado actual" de `CLAUDE.md`.
- [ ] **TASK-M14** Marcar TASK-011 como completada en `.spec/integracion-api-2bd/tasks.md` con referencia a este spec.

## Bloque G — Fix post-producción: URL pública del link (ver plan.md §7)

> Encontrado 2026-07-12 al probar la feature ya implementada: el link mostraba `http://localhost:3000/conteo/<token>`, inservible fuera del PC del admin. Dos causas distintas, dos arreglos:

- [x] **TASK-M15** Agregar `APP_BASE_URL` a `.env.example` (con comentario: debe ser la IP/hostname LAN del servidor, nunca `localhost`, en producción). **Para el MVP/pruebas locales de esta sesión**, setear `APP_BASE_URL=http://localhost:3000` en `.env.local` — sirve para validar el flujo completo abriendo el link generado en otro navegador en el mismo equipo. ⚠️ **Recordatorio explícito antes de desplegar en el servidor del Granero:** cambiar `APP_BASE_URL` a la IP/hostname LAN real (punto 7.3 de `plan.md` / `docs/infra/red-mikrotik-conteo-movil.md`) — de lo contrario el link vuelve a fallar fuera del propio servidor. Dejar este cambio anotado también en `docs/04-seguridad.md` o en el checklist de despliegue si existe.
- [x] **TASK-M16** `src/app/actions/mobile-count.ts#createMobileCountSession`: leer `process.env.APP_BASE_URL`, fallar explícito (mensaje claro, no silencioso) si falta, y devolver `{ token, url: `${APP_BASE_URL}/conteo/${token}` }` en vez de solo `{ token }`. Verifica: la respuesta de la action trae `url` armada server-side.
- [x] **TASK-M17** `src/components/inventory/CyclicCountWizard.tsx` (línea ~142): eliminar la construcción del link con `window.location.origin`; usar directamente `res.url` devuelto por la action. Verifica: el link mostrado es igual sin importar desde qué PC/navegador se crea la sesión.
- [ ] **TASK-M18** (operativa, no de código — la ejecuta Johnathan directamente en el Mikrotik, no Antigravity): aplicar la regla de firewall descrita en `docs/infra/red-mikrotik-conteo-movil.md`. Verifica: un celular conectado a la WiFi del Granero abre `http://<APP_BASE_URL>/conteo/<token-de-prueba>` y carga la página (antes fallaba/timeout).

## Bloque H — Fix post-prueba real: Realtime no actualiza + falta unidad de medida (ver plan.md §8)

> Encontrado 2026-07-12 en prueba real con productos de AZUCAR: la vista admin queda en "Esperando primer conteo…" / 0% aunque el bodeguero ya guardó varios ítems (confirmado con captura: 4 productos marcados "Guardado" en `/conteo/[token]`, progreso en `/inventario` sigue en 0 de 6). Además, la vista móvil no muestra la unidad de medida del producto — el stock del sistema es ambiguo sin saber si es unidades, libras o cajas.

- [x] **TASK-M19** Migración `supabase/migrations/015_conteo_movil_realtime.sql`: `alter publication supabase_realtime add table public.inventory_counts;` (idempotente — verificar primero con `select * from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'inventory_counts'` para no fallar si ya está agregada). **Causa raíz confirmada:** la suscripción `postgres_changes` en `CyclicCountWizard.tsx` (líneas ~62-71) está bien escrita — el problema es que `inventory_counts` nunca se agregó a la publicación `supabase_realtime`, así que Postgres nunca emite el evento sin importar qué tan bien esté el cliente. Verifica: tras la migración, guardar un conteo desde `/conteo/[token]` debe reflejarse en la barra de progreso y en "Actividad en Vivo" de `/inventario` en segundos, sin recargar.
- [x] **TASK-M20** Actualizar `get_mobile_session_items(p_token text)` en una migración nueva (`create or replace function`, mismo archivo 015) para que también devuelva la columna `unit` de `inventory_master` (ej. `UND`, `LB`, `CAJA X12` — dato no sensible, a diferencia de `cost_avg` que sigue excluido). Ajustar el tipo de retorno de la función (`returns table(..., unit text)`).
- [x] **TASK-M21** `src/app/conteo/[token]/actions.ts` (`getSessionItems`) y el tipo/interfaz de ítem en `page.tsx`: agregar el campo `unit` a la respuesta tipada.
- [x] **TASK-M22** `src/app/conteo/[token]/page.tsx`: mostrar la unidad junto al stock del sistema en cada fila (ej. "SISTEMA: 3252.5 LB" o un badge pequeño "LB" al lado de la categoría), para que el bodeguero sepa en qué unidad está contando. No mostrar `cost_avg` ni precio — eso sigue fuera del alcance de esta vista pública.
- [x] **TASK-M23** Prueba manual: repetir el conteo de la captura (productos de categoría AZUCAR), confirmar que el progreso y "Actividad en Vivo" en `/inventario` se actualizan en tiempo real al guardar cada ítem, y que cada fila en `/conteo/[token]` muestra su unidad.

## Bloque J — Segunda ronda de feedback real: header visible, orden, auto-cierre, pausa (ver plan.md §9)

- [x] **TASK-M24** `src/lib/public-routes.ts` nuevo con `PUBLIC_PATH_PREFIXES`; `src/middleware.ts` importa de ahí en vez de tener la lista hardcodeada. `src/components/ConditionalTopBar.tsx` nuevo (`'use client'`, `usePathname()`, no renderiza `<TopBar/>` si la ruta matchea algún prefijo público). `src/app/layout.tsx`: reemplazar `<TopBar />` por `<ConditionalTopBar />`. Verifica: `/conteo/[token]` y `/registro` ya no muestran la barra superior interna (FO/Nueva Orden/avatar); `/pedidos`, `/inventario`, etc. la siguen mostrando igual que antes.
- [x] **TASK-M25** Migración `supabase/migrations/017_conteo_orden_autocierre_pausa.sql`: `get_mobile_session_items` cambia su `order by` a `im.system_stock desc, im.description`. Verifica: la respuesta de la RPC llega ordenada de mayor a menor stock del sistema.
- [x] **TASK-M26** Misma migración: `submit_mobile_count` agrega al `json_build_object` de retorno exitoso `counted_items` (distinct `item_master_id` contado en la sesión) y `total_items` (mismo filtro de `get_mobile_session_items`, sin el `order by`). Verifica: la respuesta de un `submit_mobile_count` exitoso trae ambos números y son coherentes con la sesión de prueba.
- [x] **TASK-M27** Misma migración: nueva función `finish_mobile_count_session(p_token text)` (`security definer`, grant a `anon`/`authenticated`) — recalcula server-side si `counted_items >= total_items` para esa sesión; si sí, hace `update inventory_sessions set status='completed', completed_at=now()` (idempotente si ya estaba completada) y devuelve `{success:true, items_counted, total_items, discrepancies, duration_minutes}` sin ningún valor monetario. Verifica: llamarla con una sesión incompleta no cierra nada y devuelve `success:false`; con una sesión 100% contada, cierra y devuelve el resumen; llamarla dos veces seguidas no falla (idempotente).
- [x] **TASK-M28** `src/app/conteo/[token]/actions.ts`: exponer `finishSessionIfComplete(token)` que llama al RPC anterior. `page.tsx`: tras cada `submitCount` exitoso, si la respuesta trae `counted_items >= total_items`, llamar a `finishSessionIfComplete` y, si confirma cierre, mostrar una pantalla nueva "¡Conteo completado!" con el resumen (ítems contados, duración, cantidad con diferencia — sin cifras de dinero), distinta del mensaje genérico de sesión ya cerrada que ve alguien que abre el link después.
- [x] **TASK-M29** Misma migración 017: `get_mobile_session_info` agrega el caso `status = 'paused'` → `{valid:false, reason:'paused', name}`. `page.tsx`: nuevo estado visual para `reason === 'paused'` (mensaje "Este conteo está en pausa, vuelve más tarde", distinto del de "cerrado").
- [x] **TASK-M30** `src/app/actions/mobile-count.ts`: `pauseMobileCountSession(sessionId)` (`status='paused'`) y `resumeMobileCountSession(sessionId)` (`status='counting'`, `expires_at = now() + 72h`). Subir también el default de `createMobileCountSession` de 24h a 72h (constante compartida `DEFAULT_SESSION_WINDOW_HOURS`). Verifica: pausar una sesión hace que el link deje de aceptar conteos (mensaje de pausa, no de cierre); reanudar la vuelve a dejar activa y extiende el vencimiento.
- [x] **TASK-M31** UI del Paso 2B (admin, `CyclicCountWizard.tsx`): botón "Pausar conteo" junto a "Cerrar conteo"; si la sesión está pausada, mostrar badge "En pausa" + botón "Reanudar" en su lugar.
- [x] **TASK-M32** Prueba manual: pausar una sesión a medio contar y confirmar que el link muestra el mensaje de pausa; reanudarla y confirmar que vuelve a aceptar conteos; completar el 100% de los ítems de una sesión de prueba desde el celular y confirmar que se autocierra mostrando el resumen al bodeguero, sin necesidad de que el admin la cierre manualmente.
