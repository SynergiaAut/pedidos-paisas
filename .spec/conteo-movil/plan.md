# Plan Técnico: Conteo móvil por link

**Referencia:** `spec.md` (clarifications resueltas 2026-07-12). Sin dependencias de Ricardo/BD2/API Flex CRM.

## Resumen del diseño

Reutiliza el patrón ya probado en `/registro` (página pública sin auth + RPC `security definer` insert-only) pero cerrando el gap de seguridad que ese módulo dejó abierto (RLS deshabilitado). Aquí **RLS queda habilitado** en las dos tablas involucradas; el único acceso anónimo es a través de dos funciones RPC de superficie mínima.

```
Admin (autenticado)                    Bodeguero (sin auth, celular)
────────────────────                   ──────────────────────────────
/inventario → "Conteo móvil"           /conteo/[token]
  → createMobileCountSession()           → get_mobile_session_info(token)
  → inventory_sessions (insert)             → get_mobile_session_items(token)
  → muestra link + progreso realtime        → submit_mobile_count(token, item, qty, nombre)
  → closeMobileCountSession()                    ↓
                                          inventory_counts (insert-only, vía RPC)
```

## 1. Migración SQL

**Archivo nuevo:** `supabase/migrations/014_conteo_movil.sql` (idempotente, mismo estilo que 009).

```sql
-- 014: Conteo móvil por link (TASK-011). Extiende inventory_sessions/inventory_counts
-- y cierra RLS pendiente (deuda técnica #2 del roadmap) sobre ambas tablas.

-- 1. Columnas nuevas en inventory_sessions
alter table public.inventory_sessions add column if not exists link_token text;
alter table public.inventory_sessions add column if not exists expires_at timestamptz;
alter table public.inventory_sessions add column if not exists category_filter text;
alter table public.inventory_sessions add column if not exists created_by uuid references auth.users(id);
alter table public.inventory_sessions add column if not exists mode text default 'desktop'; -- 'desktop' | 'mobile_link'

create unique index if not exists inventory_sessions_link_token_key
    on public.inventory_sessions (link_token) where link_token is not null;

-- 2. Columnas nuevas en inventory_counts
alter table public.inventory_counts add column if not exists counted_by text;
alter table public.inventory_counts add column if not exists source text default 'desktop'; -- 'desktop' | 'mobile'

-- 3. RLS: cierra deuda técnica #2. Solo authenticated puede leer/escribir directo;
--    anon NUNCA toca estas tablas — solo a través de las RPC de abajo.
alter table public.inventory_sessions enable row level security;
alter table public.inventory_counts enable row level security;

drop policy if exists inventory_sessions_authenticated on public.inventory_sessions;
create policy inventory_sessions_authenticated on public.inventory_sessions
    for all to authenticated using (true) with check (true);

drop policy if exists inventory_counts_authenticated on public.inventory_counts;
create policy inventory_counts_authenticated on public.inventory_counts
    for all to authenticated using (true) with check (true);

-- 4. RPC: info de la sesión (para la pantalla /conteo/[token])
create or replace function public.get_mobile_session_info(p_token text)
returns json language plpgsql security definer as $$
declare v_session record;
begin
    select id, name, status, expires_at into v_session
    from public.inventory_sessions where link_token = p_token;

    if not found then
        return json_build_object('valid', false, 'reason', 'not_found');
    end if;

    if v_session.status <> 'counting' then
        return json_build_object('valid', false, 'reason', 'closed', 'name', v_session.name);
    end if;

    if v_session.expires_at is not null and v_session.expires_at < now() then
        return json_build_object('valid', false, 'reason', 'expired', 'name', v_session.name);
    end if;

    return json_build_object('valid', true, 'name', v_session.name);
end;
$$;

-- 5. RPC: catálogo del conteo (sin costo/precio — solo lo necesario para contar)
create or replace function public.get_mobile_session_items(p_token text)
returns table(id uuid, sku text, description text, classification text, system_stock numeric)
language plpgsql security definer as $$
declare v_session record;
begin
    select s.id, s.status, s.category_filter, s.expires_at into v_session
    from public.inventory_sessions s where s.link_token = p_token;

    if not found or v_session.status <> 'counting'
       or (v_session.expires_at is not null and v_session.expires_at < now()) then
        return;
    end if;

    return query
        select im.id, im.sku, im.description, im.classification, im.system_stock
        from public.inventory_master im
        where im.is_service = false
          and (v_session.category_filter is null or im.classification = v_session.category_filter)
        order by im.description;
end;
$$;

-- 6. RPC: insertar conteo físico (insert-only, valida token/estado/expiración/ítem)
create or replace function public.submit_mobile_count(
    p_token text,
    p_inventory_item_id uuid,
    p_counted_stock numeric,
    p_counted_by text default null
) returns json language plpgsql security definer as $$
declare v_session record;
begin
    select id, status, expires_at into v_session
    from public.inventory_sessions where link_token = p_token;

    if not found then
        return json_build_object('success', false, 'message', 'Link inválido.');
    end if;
    if v_session.status <> 'counting' then
        return json_build_object('success', false, 'message', 'Este conteo ya fue cerrado.');
    end if;
    if v_session.expires_at is not null and v_session.expires_at < now() then
        return json_build_object('success', false, 'message', 'Este link expiró.');
    end if;
    if p_counted_stock is null or p_counted_stock < 0 then
        return json_build_object('success', false, 'message', 'Cantidad inválida.');
    end if;
    if not exists (select 1 from public.inventory_master where id = p_inventory_item_id and is_service = false) then
        return json_build_object('success', false, 'message', 'Producto no válido.');
    end if;

    insert into public.inventory_counts (session_id, inventory_item_id, expected_stock, counted_stock, counted_by, source)
    select v_session.id, im.id, im.system_stock, p_counted_stock, p_counted_by, 'mobile'
    from public.inventory_master im where im.id = p_inventory_item_id;

    return json_build_object('success', true);
exception when others then
    return json_build_object('success', false, 'message', sqlerrm);
end;
$$;

-- 7. Grants mínimos: solo ejecución de las 3 funciones, nada de tablas.
grant execute on function public.get_mobile_session_info(text) to anon, authenticated;
grant execute on function public.get_mobile_session_items(text) to anon, authenticated;
grant execute on function public.submit_mobile_count(text, uuid, numeric, text) to anon, authenticated;

notify pgrst, 'reload schema';
```

**Nota de compatibilidad:** si `inventory_counts`/`inventory_sessions` tienen policies previas creadas a mano en el dashboard, `drop policy if exists` las reemplaza; revisar con `list_tables`/`get_advisors` antes de aplicar en prod (siguiendo la instrucción del MCP de Supabase).

## 2. Backend — Server Actions

**Archivo nuevo:** `src/app/actions/mobile-count.ts`

- `createMobileCountSession({ name, categoryFilter, hoursValid = 24 })`: requiere sesión (igual que `triggerInventorySync`); genera `link_token = crypto.randomUUID()`, inserta `inventory_sessions` con `status: 'counting'`, `mode: 'mobile_link'`, `expires_at: now() + hoursValid horas`, `created_by: user.id`. Devuelve `{ token, url }`.
- `closeMobileCountSession(sessionId)`: requiere sesión; `update inventory_sessions set status='completed', completed_at=now()`.
- `getMobileSessionProgress(sessionId)`: requiere sesión; cuenta filas de `inventory_counts` por `session_id` (distinct `inventory_item_id`) vs total de ítems esperados (mismo filtro de categoría) — para la barra de progreso del admin.

**Archivo nuevo (cliente público, sin `createClient` autenticado):** `src/app/conteo/[token]/actions.ts`
- `getSessionInfo(token)` → llama RPC `get_mobile_session_info`.
- `getSessionItems(token)` → llama RPC `get_mobile_session_items`.
- `submitCount(token, itemId, value, counterName)` → llama RPC `submit_mobile_count`.

Estas actions usan el cliente **anon** (`@/utils/supabase/server` sin depender de `auth.getUser()`), igual que `src/app/registro/actions.ts`.

## 3. Frontend

### 3.1 Vista pública móvil
**Archivos nuevos:** `src/app/conteo/[token]/{page.tsx,layout.tsx}` (layout propio, mobile-first, sin sidebar — mismo patrón que `src/app/registro/layout.tsx`).

Estados de la página:
1. **Cargando** → skeleton simple.
2. **Inválido/cerrado/expirado** (`valid: false`) → mensaje amigable según `reason` ("Este conteo ya fue cerrado", "Este link ya no existe", "Este link expiró") + nombre de la sesión si se conoce.
3. **Activo** → pide nombre una vez (input + botón "Continuar", guardado en `localStorage['conteo_nombre_' + token]`) → lista buscable de ítems (`get_mobile_session_items`, filtrado en cliente por texto sobre `description`/`sku`) → por cada ítem: nombre, sku, stock de sistema (referencia, no editable), input numérico grande + botón "Guardar" → al guardar, llama `submitCount`, marca la fila con ✓ y la deja editable por si se equivocó (reenviar = nueva fila insert-only, gana la última).

Diseño: reutilizar look & feel de `/registro` (fondo claro, tarjetas grandes, botones táctiles de 48px+) — es una herramienta de bodega, prioridad a inputs grandes y poco texto, no al estilo oscuro del dashboard interno.

### 3.2 Vista de administrador
**Modifica:** `src/components/inventory/CyclicCountWizard.tsx` (Paso 1 agrega selector de modo) y `src/app/inventario/page.tsx` (sin cambios estructurales, el wizard ya vive en un modal).

Paso 1 nuevo: además de nombre/categoría, un toggle **"¿Cómo se cuenta?"**:
- `Desde este computador` → flujo actual sin cambios (`startCounting` → Paso 2 tal cual existe).
- `Conteo móvil (compartir link)` → llama `createMobileCountSession`, pasa a un Paso 2B nuevo: muestra la URL completa, botón "Copiar link", botón "Compartir" (`navigator.share()` si el navegador lo soporta, fallback a copiar), y una barra de progreso con `getMobileSessionProgress` refrescada por Supabase Realtime (`supabase.channel(...).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory_counts', filter: 'session_id=eq.' + sessionId })` — autenticado, coherente con Artículo 6 de la constitución). Botón "Cerrar conteo" → `closeMobileCountSession` → Paso 3 (mismo final de éxito que ya existe).

### 3.3 Corrección de bug menor (de paso, mismo archivo)
`item.category` → `item.classification` en la fila del Paso 2 del wizard (el dato mostrado hoy siempre está vacío porque el campo real es `classification`).

## 4. Middleware

**Modifica:** `src/middleware.ts` — agregar `/conteo` a la lista de rutas públicas:

```ts
['/login', '/signup', '/registro', '/activation', '/conteo'].some((p) => pathname.startsWith(p))
```

## 5. Seguridad (repaso contra Artículo 3 de la constitución)

- ✅ Ninguna tabla queda `to public with check (true)` — todo el acceso anónimo es vía función `security definer` de superficie mínima (3 funciones, cada una valida token+estado+expiración antes de tocar datos).
- ✅ `cost_avg`/precio nunca salen de `inventory_master` hacia el link público (la función de solo lectura selecciona columnas explícitas, no `select *`).
- ✅ RLS habilitado en `inventory_sessions` e `inventory_counts` (cierra deuda #2 del roadmap para estas dos tablas).
- ⚠️ Sin captcha/rate-limit (mismo gap aceptado que `/registro`) — riesgo bajo por ser herramienta operativa interna con link no indexado ni adivinable (UUID). Si se detecta abuso, agregar validación adicional en `submit_mobile_count` (ej. límite de inserciones por minuto por token vía tabla de control).

## 6. Tests

**Archivo nuevo:** `tests/mobile-count-rpc.test.mjs` (o SQL directo vía `execute_sql` del MCP de Supabase en un branch de prueba) — casos: token válido inserta correctamente; token de sesión cerrada rechaza; token expirado rechaza; ítem `is_service=true` rechaza; cantidad negativa rechaza; dos inserciones concurrentes al mismo ítem no se bloquean (ambas quedan, la última es la vigente).

## Riesgos

1. **Policies previas desconocidas** en `inventory_sessions`/`inventory_counts` (creadas a mano, sin migración — deuda A4). Mitigar revisando con `list_tables`/`get_advisors` antes de aplicar 014 en producción.
2. **`localStorage` por token** se pierde si el bodeguero cambia de celular o borra caché — aceptable porque `counted_by` es solo referencial, no autenticación.
3. **Un mismo ítem contado dos veces** por error humano (dos personas, mismo producto) no se resuelve automáticamente — queda visible para revisión manual del admin (ver Clarifications #2 de `spec.md`).

## Dependencias

Ninguna externa. Migración 014 debe aplicarse antes de desplegar las nuevas rutas/actions. No requiere nuevas variables de entorno ni paquetes npm.

## 7. Addendum (2026-07-12): URL pública del link — bug encontrado en producción + decisión de red

Al probar la feature ya implementada, el link generado en `/inventario` mostraba `http://localhost:3000/conteo/<token>` — inservible para cualquier dispositivo que no sea el propio PC del administrador. Diagnóstico y decisión:

### 7.1 Causa (bug de implementación, no del diseño original)

`src/components/inventory/CyclicCountWizard.tsx` construye el link **en el cliente** con `window.location.origin` (línea ~142), en vez de recibirlo ya armado desde el servidor. `src/app/actions/mobile-count.ts#createMobileCountSession` hoy solo devuelve `{ token }`, no `{ token, url }` como preveía este plan originalmente (sección 2). Por eso el link refleja el navegador de quien crea la sesión, no una dirección estable de la app.

### 7.2 Fix de código requerido

- Nueva variable de entorno **`APP_BASE_URL`** (server-only, sin prefijo `NEXT_PUBLIC_` — no la necesita el cliente, la resuelve el server action): URL base estable de la instancia (LAN o nombre local), ej. `http://192.168.1.50:3000` o `http://fastorder.local:3000`.
- `createMobileCountSession` debe leer `process.env.APP_BASE_URL` (fallar explícito con mensaje claro si no está seteada — nunca inferir silenciosamente) y devolver `{ token, url: `${process.env.APP_BASE_URL}/conteo/${token}` }`.
- `CyclicCountWizard.tsx` debe **eliminar** la construcción con `window.location.origin` y usar directamente el `url` que devuelve la action.
- Agregar `APP_BASE_URL` a `.env.example` (con comentario explicando que debe ser la IP/hostname LAN del servidor, no `localhost`) y a `.env.local` real del servidor.

### 7.3 Decisión de red (arquitectura, no depende de Ricardo/BD2)

Topología del Granero: servidor Windows Server 2022 con Fast Order dockerizado, LAN donde entran los PCs del mostrador, y una WiFi separada por VLAN en el Mikrotik (RouterBoard) que **no** tiene ruteo/firewall abierto hacia la LAN — por diseño, para aislar POS/ERP/impresoras de cualquier celular conectado al WiFi.

**Decisión:** no fusionar las redes. Se agrega una **regla de firewall angosta** en el Mikrotik: permitir tráfico `forward` desde la subred WiFi hacia la IP LAN del servidor, **solo puerto 3000/tcp**, colocada antes de la regla que bloquea WiFi→LAN por defecto. Esto abre exactamente una puerta (Fast Order) sin tocar el resto del aislamiento. Documentado en detalle, con los comandos RouterOS exactos, en `docs/infra/red-mikrotik-conteo-movil.md`.

Alternativa descartada por ahora (más piezas en movimiento, queda como plan B si el cambio de firewall no fuera viable): reutilizar el túnel SSH inverso que ya expone Milenium (`docs/infra/tunel-ssh.md`) para publicar `/conteo` a internet y que los celulares entren por datos móviles en vez de la WiFi de la tienda.

## 8. Addendum (2026-07-12): Realtime no actualiza + falta unidad de medida

Prueba real con productos de categoría AZUCAR: el bodeguero guardó 4 de 6 ítems en `/conteo/[token]` (confirmados con ✓ "Guardado"), pero el panel admin en `/inventario` seguía mostrando "0 de 6 productos (0%)" y "Esperando primer conteo…" en Actividad en Vivo.

### 8.1 Causa raíz — Realtime nunca habilitado a nivel de publicación

El código de suscripción en `CyclicCountWizard.tsx` (`supabase.channel(...).on('postgres_changes', {event:'INSERT', table:'inventory_counts', filter:'session_id=eq.'+id}, ...)`) está bien escrito. El problema es de infraestructura: en Supabase, ninguna tabla emite eventos de Realtime a menos que se agregue explícitamente a la publicación lógica `supabase_realtime` (`alter publication supabase_realtime add table ...`). La migración 014 nunca lo hizo — se agregó RLS y las RPCs, pero no la publicación. Postgres nunca emitió el WAL change hacia Realtime, sin importar qué tan correcto estuviera el cliente.

**Fix:** migración 015 agrega `inventory_counts` a `supabase_realtime` (verificando primero con `pg_publication_tables` para que sea idempotente).

### 8.2 Falta la unidad de medida en la vista móvil

`get_mobile_session_items` fue diseñada deliberadamente para excluir `cost_avg`/precio (dato sensible, el link es público). Pero también quedó fuera `unit` (UND/LB/CAJA X12…), que **no es sensible** y sí es necesaria: sin ella, "3252.5" en sistema es ambiguo (¿libras? ¿unidades?) y el bodeguero puede contar en la unidad equivocada.

**Fix:** agregar `unit` al `returns table(...)` de `get_mobile_session_items` (misma migración 015) y mostrarla en cada fila de `/conteo/[token]`, junto al stock del sistema. Sigue sin exponerse `cost_avg` ni precio — el criterio de qué se expone en el link público no cambia, solo se corrige qué cuenta como "sensible".

Ver tareas concretas en `tasks.md` Bloque H (TASK-M19 a TASK-M23).

## 9. Addendum (2026-07-12, segunda sesión de prueba real): header interno visible, orden, auto-cierre y pausa

Cuarta ronda de feedback tras otra sesión real de conteo. Cuatro pedidos distintos:

### 9.1 El header interno (TopBar) se ve en la vista pública del bodeguero

Causa: `src/app/layout.tsx` es el único root layout de la app y renderiza `<TopBar />` **sin condición**, para toda ruta — incluida `/conteo/[token]` (y también `/registro`, mismo problema latente aunque no reportado hoy). El layout propio de `/conteo/[token]/layout.tsx` ya está bien hecho (header "GRANERO LOS PAISAS" naranja) pero no puede evitar que el root layout ponga el suyo encima.

**Fix (mínimo diff, sin reestructurar todas las rutas en route groups):** extraer un componente cliente `src/components/ConditionalTopBar.tsx` que use `usePathname()` y no renderice nada si la ruta actual empieza por alguno de los prefijos públicos (mismo criterio que ya usa `middleware.ts`). Para no duplicar la lista de prefijos en dos archivos, moverla a `src/lib/public-routes.ts` (`export const PUBLIC_PATH_PREFIXES = ['/login','/signup','/registro','/activation','/conteo']`) y que tanto `middleware.ts` como `ConditionalTopBar.tsx` importen de ahí. `layout.tsx` cambia `<TopBar />` por `<ConditionalTopBar />`.

### 9.2 Orden de productos por cantidad de sistema (mayor a menor)

Decisión: mayor a menor (el bodeguero enfrenta primero lo más voluminoso). Aplica en dos lugares para consistencia:
- `get_mobile_session_items` (RPC): `order by im.system_stock desc, im.description`.
- `CyclicCountWizard.tsx` (modo desktop, Paso 2): mismo criterio como orden **base**, combinado con el criterio ya existente de TASK-M10/D12 ("ya contados primero"). Orden final: 1) ya contado en esta sesión (sí/no), 2) `system_stock` descendente, 3) descripción.

### 9.3 Auto-finalizar al guardar el último conteo + consolidado para el operario

Hoy el cierre de sesión es manual y solo lo hace el admin desde `/inventario`. Se agrega auto-cierre **server-side** (no confiar en el conteo local del cliente, por conteo paralelo entre varios bodegueros):

- `submit_mobile_count` (RPC) devuelve además `counted_items` (distinct `item_master_id` con conteo en esta sesión) y `total_items` (ítems en el alcance de la sesión — mismo filtro que `get_mobile_session_items`) en su respuesta.
- Cliente: si `counted_items >= total_items` tras un guardado exitoso, llama a una nueva función `finish_mobile_count_session(p_token text)` (RPC `security definer`, ejecutable por `anon`) que **recalcula server-side** (no confía en el valor que mandó el cliente) si de verdad todos los ítems están contados; si sí, hace `status='completed', completed_at=now()` (idempotente — si ya estaba completada, solo devuelve el mismo resumen sin error) y devuelve `{ success:true, items_counted, total_items, discrepancies, duration_minutes }`. **Nunca incluye valores monetarios** (mismo criterio de "sin costo/precio en el link público" del punto 5 de este plan) — `discrepancies` es solo un conteo de ítems con diferencia, no su valor.
- Cliente (`page.tsx`): al recibir esta respuesta, cambia a un estado nuevo "Conteo completado por ti" (distinto del mensaje frío de "ya fue cerrado" que ve alguien que abre el link después de que ya se cerró) — mensaje cálido con el resumen: ítems contados, duración, cantidad con diferencia. Si alguien reabre el mismo link más tarde, ve el mensaje genérico de sesión cerrada (comportamiento ya existente).

### 9.4 Pausar / reanudar sesión

Las sesiones pueden extenderse por días según el volumen de la categoría — se necesita un estado intermedio entre "abierta" y "cerrada".

- Nuevo valor de `inventory_sessions.status`: `'paused'` (además de `'counting'` y `'completed'`).
- Server actions nuevas (autenticadas, admin únicamente — el bodeguero no pausa, solo cuenta): `pauseMobileCountSession(sessionId)` → `status='paused'`; `resumeMobileCountSession(sessionId)` → `status='counting'` y **extiende `expires_at` a `now() + 72h`** (mismo valor por defecto que se usa al crear — ver siguiente punto), para que un conteo pausado por uno o varios días no expire mientras está en pausa.
- Se sube la ventana por defecto de `expires_at` al crear una sesión de `24h` a **`72h`**, dado que ahora sabemos que hay sesiones legítimamente multi-día. Constante compartida `DEFAULT_SESSION_WINDOW_HOURS = 72` usada tanto en `createMobileCountSession` como en `resumeMobileCountSession`.
- `get_mobile_session_info`: si `status === 'paused'`, devuelve `{valid:false, reason:'paused', name}` — mensaje distinto y menos definitivo que "cerrado" (ej. "Este conteo está en pausa, vuelve más tarde"), ya que `get_mobile_session_items`/`submit_mobile_count` ya rechazan correctamente cualquier estado distinto de `'counting'` sin cambios adicionales (paused cae en esa misma condición).
- UI admin (Paso 2B del wizard): botón "Pausar conteo" junto a "Cerrar conteo"; si la sesión está pausada, se reemplaza por un badge "En pausa" + botón "Reanudar".

Ver tareas concretas en `tasks.md` Bloque J (TASK-M24 a TASK-M32).
