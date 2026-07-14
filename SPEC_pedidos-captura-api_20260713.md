# SPEC: Captura de pedidos por detección de facturas de la API (vendedor dedicado)
> Generado: 2026-07-13
> Proyecto: Fast Order (Pedidos Paisas)
> ID: —
> Handoff: Claude/Cowork → Antigravity
> Spec fuente (SDD): `.spec/pedidos-captura-api/spec.md` · Constitución: `.spec/constitution.md`

---

## 1. CONSTITUTION (Principios no negociables)

Estos principios aplican a toda esta implementación (de `.spec/constitution.md`):

- **API solo por `src/lib/flex-crm.ts`.** Ningún componente, action o route handler hace `fetch` directo a `me.services.ibla.co`. Las nuevas capacidades (facturas) se agregan como funciones tipadas dentro de ese cliente.
- **Dos bases, siempre con `db_source`.** `01` = GRANESLOSPAISAS, `02` = PAISASFISCAL. Todo dato importado lleva `db_source`. Prohibido Firebird directo, `node-firebird`/`pg` paralelos o scraping.
- **Idempotencia.** El guardado de facturas es upsert por clave natural `(db_source, tipodoc, numero)`, nunca insert ciego.
- **Sync server-side.** El sondeo a la API corre en servidor (server action / route handler), no desde el navegador. La UI reacciona vía Supabase Realtime sobre nuestras propias tablas.
- **Seguridad (Art. 3 + Ley 1581).** RLS habilitado en toda tabla nueva de negocio. `service_role` nunca llega al navegador ni a terceros. Datos de cliente (nombre/teléfono/dirección): acceso mínimo necesario.
- **Calidad (Art. 4).** TypeScript estricto, sin `any` nuevos en integración. El mapeo factura→pedido y la lógica de marca de agua tienen tests con la muestra real antes de merge. Errores de integración se registran con contexto (endpoint, `db_source`, payload truncado) — nunca `catch` silencioso.
- **NO ROMPER LO EXISTENTE.** Magic Paste, el esquema/forma de `orders`, Despacho (Realtime), Analytics e Imprimir deben seguir funcionando idénticos. Esta feature es **aditiva**.

---

## 2. SPECIFICATION (Qué se construye)

**Objetivo funcional.** Permitir que la única estación de "Pedidos" arme un pedido a partir de las **facturas reales** que ella misma genera en Millenium, detectándolas automáticamente desde la API Flex CRM (`/crm/all/invoice`), confirmándolas una a una, agregándoles los datos de entrega e imprimiendo un ticket consolidado — reemplazando la captura manual por "Magic Paste".

**Por qué.** La validación en vivo (2026-07-13, `scripts/validate-pedidos.mjs`) confirmó que las facturas traen detalle de línea real (`ID_ITEM`, `CANTIDAD`, `PRECIO`, `COSTO_KARDEX`, `MARGEN`) y `ID_VENDEDOR`. Esto elimina el parser de texto (el punto más frágil del sistema) y da datos verdaderos.

**Alcance incluido.**
- Nuevas funciones de facturas en `flex-crm.ts` (`getInvoices`, `getOneInvoice`).
- Tablas de sesión y staging de facturas (`pedido_sessions`, `pedido_invoices`).
- Poller server-side acotado (hoy + vendedor de Pedidos), con marca de agua por `NUMERO`.
- Vista de "Pedido en curso": abrir ventana, popup de confirmación por factura, agregar cliente/entrega, cerrar.
- Consolidación a un `orders` estándar (estado `TOMADO`) + ticket de impresión.

**Alcance excluido (esta fase).**
- Escritura hacia Millenium (`POST` cliente → `TERCERO`, push de eventos).
- Sincronización total de la tabla de clientes Fast Order ↔ `TERCERO`.
- Automatización sin confirmación (requeriría hora real / campo de referencia de Ricardo).
- BD2 en ejecución (se codifica para 2 bases, pero corre **BD1-only** hasta que Ricardo entregue credenciales de BD2).
- Anulaciones / notas crédito posteriores al cierre.
- Retirar Magic Paste (se decide tras probar en producción).

**Integraciones externas.** API Flex CRM (Millenium) — solo lectura. Supabase (Postgres + Auth + Realtime).

---

## 3. CLARIFICATIONS (Decisiones tomadas)

- **Decisión:** el discriminador del equipo de Pedidos es un **vendedor dedicado** (`ID_VENDEDOR` exclusivo). → **Razón:** es el único campo que la factura expone para distinguir; el "usuario" del ERP no viaja en el payload. El cliente confirmó que asignará ese vendedor.
- **Decisión:** la fuente de captura son las **facturas** (`/crm/all/invoice`), no los pedidos. → **Razón:** Los Paisas no usa el documento "pedido" (`/crm/all/order` = 0 en 30 días); factura directo en POS.
- **Decisión:** agrupación **semiautomática con confirmación por factura** (popup); la ventana abierta es la llave de correlación. → **Razón:** la API no expone hora ni llave común entre BD1 y BD2; el acto humano de abrir/cerrar + confirmar es lo más confiable.
- **Decisión:** "factura nueva" se detecta por **marca de agua = último `NUMERO` del vendedor de Pedidos por base**, tomada al abrir la ventana. → **Razón:** sin timestamp, el `NUMERO` monotónico por base es el proxy correcto; evita re-mostrar facturas viejas o de otras cajas.
- **Decisión:** los datos de entrega se capturan **en el módulo de Pedidos** (tabla de clientes de Fast Order, alimentada por el registro QR). → **Razón:** no hay registro formal de clientes en el ERP; la integración con `TERCERO` es fase futura.
- **Decisión:** **una sola estación** de Pedidos, sin concurrencia. → **Razón:** el cliente confirmó que solo esa caja hace pedidos; los demás usuarios de Fast Order son admin y recepción de domiciliarios.
- **Decisión:** el tope `MAX_INVOICES = 4` de `consolidateOrder` (heurística de Magic Paste) **no aplica** a la captura por API. → **Razón:** un pedido puede tener las facturas que el operador confirme (BD1 + BD2 + splits).
- **Decisión:** blindajes obligatorios: **marca de agua**, **persistencia del borrador en Supabase** (recuperación ante caída) y **fallback "traer últimas facturas de hoy"** (por si facturó antes de abrir la ventana). → **Razón:** hacer el flujo a prueba de la operación real.

---

## 4. PLAN (Arquitectura y enfoque)

**Stack.** Next.js (App Router) + React + TS + Tailwind · Supabase (Postgres + Auth + Realtime) · Zustand + TanStack Query. Monolito modular.

**Flujo de datos.**
```
Estación Pedidos (navegador)
  │ abre sesión → snapshot marca de agua (max NUMERO vendedor Pedidos por db)
  ▼
Server action pollPedidoInvoices(sessionId)   [server-side, mientras la sesión esté ABIERTA]
  │ flex-crm.getInvoices(db, {hoy,hoy}) filtrando ID_VENDEDOR=Pedidos y NUMERO>watermark
  ▼ upsert idempotente (db_source,tipodoc,numero)
pedido_invoices (Supabase, RLS)  ──Realtime──▶  UI: popup por factura (confirmar/descartar)
  │ confirmar → líneas (ID_ITEM,CANTIDAD,PRECIO,db_source,ID_BODEGA) al borrador
  ▼ cerrar pedido (+ datos cliente/entrega)
orders (estado TOMADO, products jsonb, invoices_data jsonb, delivery)  ← misma forma que hoy
  ▼
Despacho (Realtime, sin cambios) · Ticket de impresión consolidado (BD1#/BD2#)
```

**Estructura de archivos.**
- `src/lib/flex-crm.ts` — **extender**: `CrmInvoice`, `CrmInvoiceItem` (campos reales validados), `getInvoices(db,{fechainicial,fechafinal})`, `getOneInvoice(db,{tipodoc,numero})`. Destapar el anidado `{ factura: {...} }` (igual que se hace con `{ producto: {...} }`) y decodificar/reparar texto como en el mapper de inventario.
- `supabase/migrations/0XX_pedido_sessions_invoices.sql` — **nuevo**: `pedido_sessions` y `pedido_invoices` con RLS + índice único.
- `src/app/actions/pedidos-capture.ts` — **nuevo**: `openPedidoSession`, `pollPedidoInvoices`, `confirmInvoice`, `discardInvoice`, `removeInvoice`, `pullLatestInvoices`, `closePedido` (crea el `orders`).
- `src/app/pedidos/nuevo-api/page.tsx` (o extender `nuevo-pedido/`) — **nuevo**: UI de sesión, suscripción Realtime a `pedido_invoices`, popup, alta/búsqueda de cliente, cierre.
- `src/app/pedidos/imprimir/[id]/` — **extender**: ticket consolidado con ítems BD1+BD2 y números de factura.
- `.env.example` / `.env.local` — **agregar** `PEDIDOS_ID_VENDEDOR`.

**Datos (borrador).**
- `pedido_sessions`: `id`, `id_vendedor`, `watermark` jsonb `{ "01": n, "02": n }`, `opened_by`, `opened_at`, `status` (`ABIERTA`/`CERRADA`/`CANCELADA`), `order_id` fk.
- `pedido_invoices`: `id`, `session_id` fk, `db_source`, `tipodoc`, `numero`, `fecha`, `id_vendedor`, `nombre_tercero`, `total`, `raw` jsonb (con `items`), `detected_at`, `status` (`DETECTADA`/`CONFIRMADA`/`IGNORADA`). Único `(db_source, tipodoc, numero)`.

**Puntos de integración con lo existente (no romper).**
- `orders` se crea con la **misma forma** actual (`public_id`, `status`, `products`, `invoices_data`, `delivery_type`); la sesión/borrador vive en las tablas nuevas, no en `orders`.
- Despacho (`src/app/pedidos/page.tsx`), Analytics (`getDriverPerformance`) e Imprimir leen `orders` igual que hoy.
- Magic Paste (`src/components/sequential-paste.tsx`, `invoice_events`) queda intacto como entrada paralela/legacy.

---

## 5. TASKS (Lista de implementación priorizada)

- [ ] **T1 — `flex-crm.ts`: facturas.** Agregar `CrmInvoice`/`CrmInvoiceItem` (campos reales de `scripts/validacion-pedidos-MUESTRA.json`), `getInvoices` y `getOneInvoice`, destapando `{factura:{}}` y con `db_source`. *Resultado:* funciones tipadas + test unitario que parsea la muestra real (cabecera + `items`).
- [ ] **T2 — Migración SQL.** Crear `pedido_sessions` y `pedido_invoices` con RLS habilitado y único `(db_source,tipodoc,numero)`. *Resultado:* migración idempotente aplicada; políticas RLS cerradas (sin `to public with check (true)`).
- [ ] **T3 — Config vendedor.** Agregar `PEDIDOS_ID_VENDEDOR` a `.env.example` y leerlo server-side. *Resultado:* discriminador configurable, no hardcodeado.
- [ ] **T4 — Poller server-side.** `pollPedidoInvoices(sessionId)`: consulta hoy+vendedor por base, filtra `NUMERO>watermark`, upsert en `pedido_invoices`, log de errores con contexto. *Resultado:* detecta solo facturas nuevas del vendedor de Pedidos; test con la muestra.
- [ ] **T5 — Abrir sesión.** `openPedidoSession`: crea `pedido_sessions` y toma la marca de agua (max `NUMERO` del vendedor por `db_source`). *Resultado:* sesión `ABIERTA` con watermark persistido.
- [ ] **T6 — UI + popup.** Vista de pedido en curso: suscripción Realtime a `pedido_invoices`; por cada factura `DETECTADA`, popup confirmar/descartar; al confirmar, agrega líneas al borrador. *Resultado:* captura "mágica" con datos reales.
- [ ] **T7 — Cliente/entrega.** Buscar en la tabla de clientes de Fast Order (registro QR) o alta rápida; adjuntar nombre/teléfono/dirección/notas al borrador. *Resultado:* datos de entrega listos para el ticket.
- [ ] **T8 — Cerrar pedido → `orders`.** `closePedido`: consolida facturas `CONFIRMADA`, crea `orders` (`TOMADO`, `products`, `invoices_data`, entrega) **sin** el tope `MAX_INVOICES`; enlaza `order_id` en la sesión. *Resultado:* pedido visible en Despacho, idéntico al flujo actual.
- [ ] **T9 — Ticket consolidado.** Extender `imprimir/[id]` con ítems BD1+BD2, cantidades, precios, total y los números de factura (BD1#/BD2#). *Resultado:* ticket imprimible con trazabilidad.
- [ ] **T10 — Blindajes.** Fallback "traer últimas facturas de hoy" (`pullLatestInvoices`), quitar factura del borrador y anti-duplicado. *Resultado:* robustez operativa.
- [ ] **T11 — Recuperación.** Persistir y recuperar el borrador (sesión + facturas confirmadas) al reabrir la estación. *Resultado:* no se pierde un pedido a medias.
- [ ] **T12 — Regresión.** Verificar que Magic Paste, Despacho, Analytics e Imprimir siguen intactos; `npm run build` y `npm run lint` limpios. *Resultado:* cero regresiones.

---

## 6. CONTEXTO PARA ANTIGRAVITY

### Keywords para buscar en el KM
- milenium api flex crm
- flex-crm.ts getInvoices
- captura pedidos vendedor dedicado
- pedido_invoices pedido_sessions marca de agua
- orders TOMADO despacho realtime
- magic paste sequential-paste
- db_source BD1 BD2 idempotente
- registro clientes QR tercero

### Archivos relevantes en el repositorio
- `.spec/pedidos-captura-api/spec.md` — spec SDD completo (fuente de verdad de esta feature)
- `.spec/constitution.md` — principios no negociables
- `src/lib/flex-crm.ts` — única puerta a la API; aquí se agregan las facturas
- `src/app/actions/orders.ts` — `consolidateOrder`, `MAX_INVOICES=4` (no reutilizar el tope)
- `src/components/sequential-paste.tsx` — Magic Paste (NO tocar; queda como legacy)
- `src/app/pedidos/page.tsx` — Despacho (Realtime; no romper)
- `src/app/pedidos/imprimir/[id]/` — impresión (extender para el ticket)
- `src/app/api/milenium/*` — patrón de route handlers de integración existentes
- `docs/modulos/pedidos.md`, `docs/modulos/despacho.md` — comportamiento actual
- `scripts/validate-pedidos.mjs` — script de validación de la API
- `scripts/validacion-pedidos-MUESTRA.json` — factura real con `items` (base de los tests de mapeo)

### Próximo paso recomendado
Empezar por **T1**: agregar `getInvoices`/`getOneInvoice` tipados en `src/lib/flex-crm.ts` y validarlos con un test contra `scripts/validacion-pedidos-MUESTRA.json` antes de tocar la UI.
