# Spec: Conteo móvil por link (TASK-011)

**Fase SDD:** Specification → Clarification resuelta en esta sesión (sin dependencias de Ricardo/BD2) → lista para `plan.md`.
**Origen:** metodología original del proyecto (desviación documentada en `docs/modulos/inventario.md`), registrada como TASK-011 en `.spec/integracion-api-2bd/tasks.md` (Bloque D).
**Por qué ahora:** BD2 sigue bloqueada por credenciales de Ricardo (ver `docs/roadmap.md`, I-1/I-3). Esta feature no depende del ERP en absoluto — es 100% interna a Supabase/Next.js y mejora directamente la experiencia de usuario del módulo de inventario mientras se resuelve el bloqueo.

## Problema que resuelve

`CyclicCountWizard` (el asistente actual) solo cuenta desde el navegador de un administrador, de un producto a la vez, uno por uno, sentado frente a un computador. La metodología original de conteo cíclico requiere que **los bodegueros cuenten desde su celular, en la bodega, en paralelo** (varias personas contando secciones distintas al mismo tiempo) — así el conteo cíclico es una práctica semanal ligera y no un evento que exige parar la operación y usar un solo equipo.

## Usuarios objetivo

- **Camilo / Alejandra (admin):** abren un conteo nuevo, comparten un link (WhatsApp), ven el progreso en vivo, lo cierran cuando termina.
- **Bodegueros (sin cuenta, sin login):** abren el link en su celular, buscan el producto que tienen en la mano, digitan la cantidad física y siguen al siguiente. No necesitan credenciales — igual que el registro de clientes por QR (`docs/modulos/registro-clientes.md`), patrón ya probado en este proyecto.

## Historias de usuario

- Como administrador, quiero generar un link de conteo (con o sin filtro de categoría) y compartirlo por WhatsApp, para que varios bodegueros cuenten en paralelo sin que yo digite nada.
- Como bodeguero, quiero abrir el link en mi celular, buscar el producto y escribir la cantidad física, sin loguearme ni instalar nada.
- Como administrador, quiero ver en tiempo real cuántos productos ya se contaron mientras el conteo está abierto, para saber cuándo cerrarlo.
- Como administrador, quiero cerrar el conteo cuando termina, para que el link deje de aceptar respuestas (aunque alguien lo tenga abierto o lo reenvíe).
- Como dueño del negocio, quiero que el link público **nunca** muestre costo (`cost_avg`) ni precio de venta — solo descripción, SKU y stock del sistema — para no exponer márgenes a personal de bodega vía un link que se puede reenviar.

## Criterios de aceptación

- [ ] Desde `/inventario`, "Nuevo Conteo" ofrece dos modos: **"Contar en este computador"** (comportamiento actual del wizard, sin cambios) y **"Conteo móvil (compartir link)"** (nuevo).
- [ ] Al crear un conteo móvil se genera un token único, impredecible, y una URL pública `/conteo/[token]` sin necesidad de sesión.
- [ ] El link solo acepta conteos mientras la sesión está en estado `counting`; al cerrarla (o si expira) cualquier intento de escritura falla con un mensaje claro, tanto para nuevas cargas de la página como para envíos ya en curso.
- [ ] Expiración por defecto de seguridad: 24 h desde la creación, aunque el administrador olvide cerrarla manualmente.
- [ ] Varias personas pueden abrir el mismo link y contar productos distintos **al mismo tiempo** sin bloquearse ni pisarse (cada envío es una inserción independiente).
- [ ] La vista móvil **no expone `cost_avg`** ni ningún dato de precio/costo — solo `sku`, `description`, `classification`, `system_stock`.
- [ ] Todo el acceso público (lectura del catálogo del conteo y escritura del conteo físico) pasa **exclusivamente por funciones RPC `security definer`** — cero grants directos de `anon` sobre tablas (mismo espíritu que el registro de clientes, pero sin repetir su error: aquí no se deshabilita RLS, se cierra por completo y se abre una rendija angosta vía función).
- [ ] `inventory_sessions` e `inventory_counts` quedan con RLS habilitado (cierra la deuda técnica #2 del roadmap para estas dos tablas).
- [ ] El administrador ve, en la misma pantalla donde generó el link, el progreso en vivo (Supabase Realtime, autenticado) y un botón "Cerrar conteo".
- [ ] El nombre de quien cuenta (`counted_by`, texto libre, opcional) se guarda por cada registro para poder auditar después quién contó qué.
- [ ] Bug encontrado de paso en `CyclicCountWizard`: la fila de cada ítem muestra `item.category`, pero el dato que se carga y filtra es `classification` — el campo mostrado siempre sale vacío. Se corrige junto con esta feature ya que se toca el mismo componente.

## Fuera de alcance (esta fase)

- Generar imagen QR (se resuelve con "copiar link" + `navigator.share()` de WhatsApp; QR queda como mejora futura, no bloquea el valor de negocio).
- ~~Reconciliar automáticamente `physical_stock` en `inventory_master` al cerrar el conteo~~ — **actualizado en `.spec/dashboard-conteos/`**: sí se escribe `physical_stock`/`last_counted_at` en cada conteo válido (era la semántica original de la migración 013, antes de esta feature). Lo que sigue sin tocarse nunca es `system_stock` (el teórico de Milenium) — esa es la garantía real, no el nombre del campo.
- Notificaciones push/SMS cuando el conteo se cierra.
- Captcha o rate-limiting anti-abuso (mismo gap ya aceptado y documentado para `/registro`; bajo riesgo porque es una herramienta operativa interna, no de cara al cliente final).
- Segmentación de un mismo link en sub-secciones por bodeguero (v1 = un link por sesión de conteo; si dos personas cuentan el mismo ítem, gana el último envío — ver Clarifications).

## Clarifications

Decisiones tomadas en esta sesión (sin necesidad de Ricardo, todas internas):

1. **¿Un token corto/legible o un UUID?** → UUID completo generado en servidor (`crypto.randomUUID()`), sin dependencias nuevas. No es "bonito" pero es criptográficamente seguro y evita añadir librerías. El QR/short-link queda para una iteración futura si se necesita.
2. **¿Qué pasa si dos bodegueros cuentan el mismo producto?** → `inventory_counts` es un log **insert-only** (nunca se actualiza una fila existente); el conteo "vigente" de un ítem dentro de una sesión es el último registro por `(session_id, inventory_item_id)` ordenado por `created_at`. Si hay conflicto, se ve en el detalle del conteo (fase de revisión manual del admin), no se resuelve automáticamente.
3. **¿La sesión existente (`inventory_sessions`) se reemplaza o se extiende?** → Se extiende: mismo modelo que ya usa `CyclicCountWizard`, agregando `link_token`, `expires_at`, `category_filter`, `created_by`. El wizard de escritorio sigue funcionando exactamente igual; el modo móvil es una rama nueva del mismo flujo (Paso 1).
4. **¿Cómo evita el bodeguero volver a escribir su nombre en cada producto?** → Se pide una vez al entrar al link y se guarda en `localStorage` del dispositivo (clave por token), no en una cuenta — coherente con "sin login".
5. **¿Realtime público (anon) para que el bodeguero vea el progreso de otros?** → No. Realtime autenticado solo para el admin (Artículo 6 de la constitución). La vista móvil no necesita ver el progreso global, solo confirmar que su propio envío se guardó (check ✓ por fila).

## Siguiente paso

`plan.md` con el diseño técnico completo (migración SQL, funciones RPC, estructura de archivos Next.js, cambios en `middleware.ts`) → `tasks.md` atómico → implementación en Antigravity vía handoff.
