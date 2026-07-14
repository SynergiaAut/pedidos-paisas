# SPEC (FIXES): Correcciones tras la Prueba A — Captura de pedidos por API
> Generado: 2026-07-13
> Proyecto: Fast Order (Pedidos Paisas)
> Handoff: Claude/Cowork → Antigravity
> Depende de: `SPEC_pedidos-captura-api_20260713.md` y `.spec/pedidos-captura-api/spec.md` (feature ya implementada)

---

## 1. RESULTADO DE LA PRUEBA A (contexto — NO re-implementar)

Se hizo una simulación controlada inyectando 2 facturas (BD1 + BD2) en una sesión abierta. **El camino feliz PASÓ:**
- Detección → popup por factura → "Confirmar e Integrar".
- Consolidación **BD1 + BD2** en un solo pedido con ítems/cantidades/precios reales.
- Cliente + entrega, cierre, creación de `orders` en estado `TOMADO`, visible en Despacho con las dos facturas y el total.
- Ticket impreso con trazabilidad de facturas (BD1‑POS‑… / BD2‑POS‑…).

**No romper nada de lo anterior.** Estas correcciones son puntuales sobre lo ya construido. Regla transversal: Despacho, Analytics, Imprimir y Magic Paste deben seguir intactos.

---

## 2. CONSTITUTION (recordatorio aplicable)

- API solo por `src/lib/flex-crm.ts` (timeouts y manejo de error viven ahí y en la action).
- Errores de integración se registran con contexto y **nunca** rompen la UX (Art. 4). Un server action de sondeo jamás debe lanzar hacia el cliente.
- `db_source` en todo dato importado; idempotencia por `(db_source, tipodoc, numero)`.
- Datos de cliente (nombre/teléfono/dirección) con acceso mínimo (Art. 3, Ley 1581).

---

## 3. TASKS DE CORRECCIÓN (priorizadas)

### F1 — [P1] Poller resiliente (bug de confiabilidad)
**Síntoma:** en consola `Error running poller: An unexpected response was received from the server. at fetchServerAction`.
**Causa probable:** `pollPedidoInvoices` (`src/app/actions/pedidos-capture.ts`) llama a la API real (`getInvoices`) para el vendedor configurado; con el ERP/túnel caído o BD2 sin credenciales, la llamada se cuelga o el server action revienta a nivel de framework (timeout largo / payload no serializable). Aunque hay `try/catch` por base, el error igual burbujea al cliente.
**Fix esperado:**
- `getInvoices` en `flex-crm.ts` con **timeout corto** (ej. 15–20 s, no 120 s) y `AbortSignal.timeout`.
- Si `FLEX_CRM_EMAIL_02` / `CLAVE_02` no están, **no intentar BD2** (no construir el cliente ni llamar) — degradar en silencio con un `errors.push` informativo.
- `pollPedidoInvoices` **nunca** debe lanzar: envolver todo y retornar siempre `{ success, count, errors }` serializable.
- En el cliente (`nuevo-api/page.tsx`, `runPoller`), capturar y **no** propagar el error a consola como excepción; mostrar un aviso discreto ("Sin conexión con el ERP, reintentando").
- Reproducir con los logs del servidor de Next para confirmar la causa exacta antes de cerrar.
**Resultado:** con el ERP caído o BD2 ausente, la vista sigue usable y sin errores rojos en consola.

### F2 — [P1] Realtime estable (la detección "mágica" depende de esto)
**Síntoma:** en consola `WebSocket connection to wss://…supabase.co/realtime/v1/… failed`. Los popups sí aparecieron, pero el WS se cayó.
**Fix esperado:**
- Verificar que `pedido_invoices` está en la publicación `supabase_realtime` (migración 019 la agrega) y su `replica identity`.
- Confirmar que el canal (`session-invoices-${session.id}` con `filter: session_id=eq…`) **reconecta** solo; si el WS cae, refrescar por un **polling ligero de respaldo** a `pedido_invoices` para no perder facturas detectadas.
- Confirmar que no es un corte transitorio de red del entorno de desarrollo (probar reconexión).
**Resultado:** las facturas detectadas aparecen de forma fiable aunque el WS tenga cortes.

### F3 — [P2] El ticket no cuadra por dentro (IVA / neto vs bruto)
**Síntoma:** en el ticket, el total por línea usa `precio × cantidad` (**neto**), pero el TOTAL grande es la suma de las facturas (**con IVA**); las líneas no suman el total (ej. GRANEL: $12.428,58 en ticket vs $13.050 real).
**Causa raíz:** `closePedido` (`pedidos-capture.ts`, ~línea 324) guarda `{ name, qty, price }` y **descarta** `item.TOTAL`; el ticket (`imprimir/[id]/page.tsx`, ~línea 189) recalcula `p.price * p.qty`.
**Fix esperado:**
- En `closePedido`, guardar también `total: Number(item.TOTAL)` (y opcional `iva`) por producto.
- En el ticket, mostrar `formatMoney(p.total ?? p.price * p.qty)` para que las líneas **sí sumen** el total; si se quiere, agregar renglón de IVA.
**Resultado:** el ticket es internamente consistente y coincide con las facturas.

### F4 — [P2] Observaciones del vendedor en el ticket (nuevo requerimiento)
**Síntoma:** el vendedor escribe observaciones (ej. "REJAS NEGRAS") y **no salen en el ticket**. Hoy `order.observations` = `"[ENTREGA EN: <dirección>] <observaciones>"`; el ticket solo extrae la dirección con regex y bota el resto.
**Fix esperado:**
- En el ticket (`imprimir/[id]/page.tsx`, bloque Client Info) agregar un renglón **"Observaciones:"** que muestre el texto libre, quitando el prefijo `[ENTREGA EN: …]`. Debe verse tanto en DOMICILIO como en Recoge en Tienda (en tienda no hay prefijo, se muestra tal cual).
- (Mejor a futuro) en `closePedido`, guardar **dirección** y **observaciones** en campos separados en `orders` en vez de concatenarlas, y que el ticket lea cada uno. Si se hace el mínimo por ahora, dejar anotada esta deuda.
**Resultado:** el ticket muestra "Observaciones: REJAS NEGRAS" (o lo que ingrese el vendedor).

### F5 — [P3] Branding y datos del encabezado del ticket
**Síntoma:** el pie dice **"Sistema desarrollado por AntiGravity"** y el encabezado trae datos placeholder (`NIT 123.456.789-0`, `Calle Principal #10-20`).
**Fix esperado:** pie → "Synerg‑IA Automation" (o quitarlo); encabezado con el **NIT y dirección reales** del Granero Los Paisas (idealmente desde configuración, no hardcode).
**Resultado:** ticket de cara al cliente con datos e identidad correctos.

### F6 — [P3] Navegación + seam de prueba
**Síntoma:** la vista nueva vive en `/pedidos/nuevo-api` pero **no hay enlace de menú** (el botón "Nuevo Pedido" lleva al viejo `/nuevo-pedido` de Magic Paste); solo se llega por URL.
**Fix esperado:**
- Agregar el acceso a `/pedidos/nuevo-api` en la barra (nuevo botón, o decidir cuál flujo es el oficial de la estación de Pedidos).
- Opcional (dev): botón **"Simular factura detectada"** (server action que inserta una `pedido_invoices` simulada en la sesión abierta) para probar sin usar el SQL Editor.
**Resultado:** el módulo es alcanzable desde la UI y fácil de probar.

---

## 4. CONTEXTO PARA ANTIGRAVITY

### Keywords para buscar en el KM
- pollPedidoInvoices resiliente timeout
- supabase realtime pedido_invoices websocket
- closePedido products total IVA ticket
- imprimir ticket observaciones entrega
- flex-crm getInvoices timeout db_source

### Archivos relevantes
- `src/app/actions/pedidos-capture.ts` — `pollPedidoInvoices` (F1), `closePedido` (F3, F4)
- `src/lib/flex-crm.ts` — `getInvoices` (F1: timeout / skip BD2 sin creds)
- `src/app/pedidos/nuevo-api/page.tsx` — `runPoller` (F1), suscripción Realtime (F2), navegación (F6)
- `src/app/pedidos/imprimir/[id]/page.tsx` — línea ~189 total por línea (F3), bloque cliente (F4), pie/encabezado (F5)
- `supabase/migrations/019_pedido_sessions_invoices.sql` — publicación realtime (F2)
- `.spec/pedidos-captura-api/spec.md` — spec de la feature

### Próximo paso recomendado
Empezar por **F1** (poller resiliente) reproduciendo con los logs del servidor; luego F2, F3 y F4. F5/F6 son pulido. Al terminar, correr una **Prueba B real de solo lectura** con una venta verdadera del vendedor dedicado.
