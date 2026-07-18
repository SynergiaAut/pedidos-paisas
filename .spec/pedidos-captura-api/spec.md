# Spec: Captura de pedidos por detección de facturas de la API (vendedor dedicado)

**Fase SDD:** Specification → Clarification resuelta en esta sesión → lista para `plan.md`.
**Origen:** validación en vivo de la API Flex CRM para el módulo Pedidos (2026-07-13), con `scripts/validate-pedidos.mjs`. Reemplaza/complementa el enfoque "Magic Paste" documentado en `docs/modulos/pedidos.md`.
**Por qué ahora:** la validación confirmó que `/crm/all/invoice` entrega las facturas con **detalle de línea real** (`ID_ITEM`, `CANTIDAD`, `PRECIO`, `COSTO_KARDEX`, `MARGEN`) y con `ID_VENDEDOR`. Esto habilita capturar los pedidos **directamente de la API** —más confiable que leer texto pegado— sin depender de que Ricardo entregue nuevos endpoints. El único bloqueo parcial es BD2 (credenciales), que no impide arrancar con BD1.

## Contexto validado (no re-descubrir)

Corrida real sobre BD1 (2026-07-13, ver `scripts/validacion-pedidos-REPORTE.json` y `-MUESTRA.json`):

- **Los Paisas no usa "pedidos" del ERP** (`/crm/all/order` → 0 en 30 días). Facturan directo en POS. **La fuente de captura son las facturas** (`/crm/all/invoice`), no los pedidos.
- `/crm/all/invoice` (rango de fechas) devuelve `invoices: [{ factura: {...} }]` (anidado). Cabecera real: `FECHA`, `ID_TIPO_DOC` (`POS`), `NUMERO`, `ID_TERCERO`, `NOMBRE_TERCERO`, `ID_VENDEDOR`, `NOMBRE_VENDEDOR`, `DIRECCION`, `TELEFONO`, ciudad/depto, `items`.
- Cada línea de `items`: `ID_ITEM`, `DESCRIPCION_ITEM`, `ID_BODEGA`, `CANTIDAD`, `PRECIO`, `SUBTOTAL`, `TASA_IVA`, `TOTAL`, `COSTO_KARDEX`, `MARGEN`. **Sí hay precio de venta a nivel de línea** (el catálogo no lo tenía).
- **No hay hora** en la cabecera (`FECHA` es fecha; `FECHA_DESPACHO` = fecha-cero de Firebird, hora no confiable) y el cliente suele ser el genérico `REMISION COMERCIAL` (`ID_TERCERO:1`). ⇒ No existe llave natural ni timestamp para unir automáticamente la factura de BD1 con la de BD2 del mismo pedido.
- Latencia alta y variable (≈12 s el mes completo). Toda consulta debe ir **acotada por fecha (hoy) + vendedor**, nunca "traer todo".

## Problema que resuelve

El módulo actual de captura ("Magic Paste", `src/components/sequential-paste.tsx`) exige que el cajero **copie y pegue el texto del recibo** y depende de un parser por regex —el punto más frágil del sistema (constitución Art. 4)— que además nunca se validó en firme. Con la API disponible, un solo equipo dedicado (la caja de "Pedidos") puede armar el pedido a partir de las **facturas reales que él mismo genera**, con datos verdaderos (ítems, cantidades, precios) y sin re-digitar ni depender de un parser.

## Proceso actual del negocio (aclarado con el cliente)

- La colaboradora de pedidos se llama **Milena**. En el ERP usa los usuarios `AUXILIAR` y `PEDIDOS` en Fiscal, y `AUXILIAR` en la otra base.
- La API de facturas no expone de forma visible el usuario de login (`AUXILIAR`/`PEDIDOS`), pero sí expone vendedor: **`ID_VENDEDOR = 1112223087`, `NOMBRE_VENDEDOR = SALAZAR MOLINA ANA MILENA`**. Ese será el discriminador operativo de su facturación.
- Milena trabaja con varias ventanas de Millenium abiertas en las 2 bases y atiende varios clientes al tiempo: WhatsApp, mostrador y llamadas pueden interrumpirse y retomarse. ⇒ Fast Order debe modelar una **mesa multi-pedido**, no un formulario lineal de un solo pedido.
- Un pedido puede contener productos de BD1 y BD2, por lo que puede generar **más de una factura** (una por base), emitidas de forma casi simultánea durante la atención.

## Usuarios objetivo

- **Milena / Vendedor de Pedidos:** mantiene varios borradores abiertos, alterna entre clientes, factura en Millenium, confirma cada factura que Fast Order detecta, agrega datos del cliente/entrega y cierra el pedido imprimiendo su ticket.
- **Administración:** ve los pedidos resultantes (sin cambios en su vista).
- **Recepción de domiciliarios / Despacho:** consume los pedidos por la vista de Despacho **exactamente igual que hoy** (Realtime sobre `orders`).

## Flujo principal (camino oficial)

1. Milena **abre un borrador** en la mesa de pedidos, opcionalmente con referencia de cliente/canal (`WhatsApp`, `Mostrador`, `Teléfono`). Al abrir, Fast Order guarda la **marca de agua** = último `NUMERO` del vendedor Milena en cada base (BD1/BD2).
2. El vendedor **factura en Millenium** la(s) factura(s) del pedido y las imprime (flujo normal del ERP, no cambia).
3. Fast Order **sondea** `/crm/all/invoice` (hoy + vendedor de Pedidos) mientras la ventana está abierta y detecta las facturas con `NUMERO >` la marca de agua, aún no asignadas.
4. Por cada factura detectada aparece una **ventana emergente**; el vendedor **confirma** y sus líneas se agregan al pedido "de manera mágica" (ítems, cantidades y precios reales, ya sin digitar).
5. El vendedor **agrega los datos del cliente/entrega** (buscándolo en la tabla de clientes de Fast Order —los registrados por QR— o creándolo al momento) y **confirma el pedido**.
6. Fast Order **consolida** las facturas (líneas de BD1 + BD2), crea el `orders` estándar (estado `TOMADO`) e **imprime el ticket del pedido**. A partir de ahí el pedido fluye a Despacho sin cambios.

## Reglas de la detección inteligente

- **Universo:** solo facturas con `ID_VENDEDOR = <vendedor de Pedidos>`, `FECHA = hoy`, en BD1 y BD2. Nunca se tocan las facturas de las cajas normales.
- **"Nuevas" = por marca de agua:** una factura es candidata si su `NUMERO` es mayor que la marca registrada al abrir la ventana (por `db_source`) y no está asignada a ningún pedido. No se usa la hora (la API no la da).
- **Confirmación humana obligatoria** por cada factura (popup) antes de agregarla — es el reemplazo confiable del timestamp/llave inexistentes.
- **Fallback retroactivo:** botón "traer últimas facturas de hoy del vendedor de Pedidos" para adjuntar facturas emitidas antes de abrir la ventana (por si el vendedor facturó primero).
- **Persistencia del borrador:** la sesión de pedido y las facturas ya confirmadas se guardan en Supabase mientras la ventana está abierta, para recuperación ante cierre/caída del PC.
- **Multi-borrador para una operadora:** se soportan varios borradores abiertos para Milena en una misma estación. No se soportan todavía dos operadores simultáneos usando el mismo `ID_VENDEDOR`.

## Criterios de aceptación

- [ ] Existe una vista de "Pedido en curso" para la estación de Pedidos que abre una sesión, registra la marca de agua por `db_source` y queda a la espera de facturas.
- [ ] Existe una vista de **mesa multi-pedido** que lista varios borradores abiertos, permite crear uno nuevo por canal/referencia y cambiar entre ellos sin perder el estado.
- [ ] Un poller server-side consulta `/crm/all/invoice` acotado a **hoy + vendedor de Pedidos** en BD1 y (cuando haya credenciales) BD2, **solo mientras haya una sesión abierta**, y sin traer catálogos completos.
- [ ] Cada factura detectada (por marca de agua, no asignada) aparece como popup con su resumen (número, base, total, ítems) para que el vendedor **confirme o descarte**.
- [ ] Al confirmar una factura, sus líneas reales (`ID_ITEM`, `CANTIDAD`, `PRECIO`, `TOTAL`, `db_source`, `ID_BODEGA`) se agregan al pedido; al descartarla, se marca como ignorada y no vuelve a aparecer.
- [ ] El vendedor puede **quitar** una factura ya agregada antes de cerrar, y el sistema **evita duplicar** la misma factura (clave `db_source + tipodoc + numero`).
- [ ] El botón "traer últimas facturas de hoy" lista las últimas N facturas del vendedor de Pedidos para adjuntar retroactivamente.
- [ ] El vendedor agrega/asocia el cliente (búsqueda en la tabla de clientes de Fast Order o alta rápida) con nombre, teléfono y dirección de entrega.
- [ ] Al cerrar el pedido se crea un registro en `orders` con la **misma forma que hoy** (estado `TOMADO`, `products` jsonb, `invoices_data` jsonb, datos de entrega) — de modo que **Despacho, Analytics e Imprimir funcionan sin cambios**.
- [ ] El ticket del pedido imprime: datos del cliente/entrega, ítems consolidados de BD1+BD2 con cantidades y precios, total, y los **números de factura (BD1 # / BD2 #)** que lo componen (trazabilidad).
- [ ] Si Fast Order o el PC se cierra con un pedido a medias, al reabrir la estación se **recupera** el borrador (sesión + facturas confirmadas).
- [ ] Todo acceso a la API pasa por `src/lib/flex-crm.ts` (nuevas funciones `getInvoices` / `getOneInvoice` tipadas); ningún componente hace `fetch` a la API (constitución Art. 2).
- [ ] Toda factura importada lleva `db_source`; el guardado es idempotente por clave natural `(db_source, tipodoc, numero)` (constitución Art. 2).
- [ ] El mapeo factura→pedido y la lógica de marca de agua tienen **tests con la muestra real** (`scripts/validacion-pedidos-MUESTRA.json`) antes de merge (constitución Art. 4).
- [ ] RLS habilitado en las nuevas tablas; `service_role` nunca llega al navegador; datos de cliente (nombre/teléfono/dirección) con acceso mínimo (constitución Art. 3, Ley 1581).

## No romper lo que ya funciona (compatibilidad)

- **Magic Paste queda intacto** (`sequential-paste.tsx`, `InvoiceCaptureModal`, `invoice_events`): no se elimina ni se modifica en esta fase; la captura por API es una **entrada nueva y paralela** que produce el mismo `orders`.
- **Esquema `orders` sin cambios de forma:** se sigue creando con `public_id` (PED-XXXX), `status` (`TOMADO`→`DESPACHO`→`PAGADO`), `products` jsonb, `invoices_data` jsonb, `delivery_type`. La sesión/borrador vive en **tablas nuevas separadas**, no en `orders`, para no alterar los estados que consume Despacho.
- **Despacho, Analytics e Imprimir** (`src/app/pedidos/`, `getDriverPerformance`, `src/app/pedidos/imprimir/[id]/`) siguen leyendo `orders` igual que hoy; solo se **extiende** la impresión para el ticket consolidado.
- **Inventario y su sync** no se tocan; la captura de pedidos es de solo lectura sobre la API (no escribe en Millenium).

## Diseño de datos (borrador para `plan.md`)

- Tabla `pedido_sessions`: `id`, `id_vendedor`, `watermark` jsonb `{ "01": <numero>, "02": <numero> }`, `opened_by`, `opened_at`, `status` (`ABIERTA`/`CERRADA`/`CANCELADA`), `order_id` (fk al `orders` creado al cerrar), y metadatos de mesa multi-pedido (`draft_label`, `source_channel`, `customer_hint`, `last_active_at`).
- Tabla nueva `pedido_invoices` (staging idempotente): `id`, `session_id`, `db_source`, `tipodoc`, `numero`, `fecha`, `id_vendedor`, `nombre_tercero`, `total`, `raw` jsonb (con `items`), `detected_at`, `status` (`DETECTADA`/`CONFIRMADA`/`IGNORADA`). Único `(db_source, tipodoc, numero)`.
- `flex-crm.ts`: `CrmInvoice` + `CrmInvoiceItem` (campos reales validados), `getInvoices(db, { fechainicial, fechafinal })`, `getOneInvoice(db, { tipodoc, numero })`.
- Config: `PEDIDOS_ID_VENDEDOR` en `.env.example`/`.env.local` (o tabla de configuración) para el código del vendedor dedicado.
- Realtime (Art. 6): el poller server-side escribe en `pedido_invoices`; la ventana de Pedidos se suscribe por Supabase Realtime para mostrar el popup — el sondeo a la API es server-side, la UI reacciona a nuestra tabla.

## Fuera de alcance (esta fase)

- **Escritura hacia Millenium** (`POST` cliente → `TERCERO`, push de eventos): fase futura, depende de que Ricardo la habilite.
- **Sincronización total** de la tabla de clientes de Fast Order ↔ `TERCERO` de Millenium (emparejar/deduplicar): fase futura; aquí solo se consume la tabla propia (registro por QR) para los datos de entrega.
- **Automatización sin confirmación** (quitar el popup): requeriría pedirle a Ricardo la **hora real de la factura** y/o un **campo de observaciones/referencia**. No se implementa ahora.
- **BD2:** el código se diseña para 2 bases, pero queda **BD1-only en ejecución** hasta que Ricardo entregue las credenciales de BD2 (los pedidos con productos de BD2 no capturarán esa factura mientras tanto).
- **Anulaciones / notas crédito posteriores al cierre:** en esta fase solo se maneja quitar/duplicar antes de cerrar; la reconciliación de anulaciones post-cierre queda para una iteración futura.
- **Retirar Magic Paste:** se decide una vez la captura por API esté probada en producción.

## Clarifications (decisiones tomadas en esta sesión)

1. **Discriminador del equipo de Pedidos** → **vendedor dedicado**. La caja de Pedidos factura con un `ID_VENDEDOR` exclusivo (único campo que la factura expone para distinguir). No se depende de que Ricardo exponga el "usuario" del ERP.
2. **Cómo unir facturas del mismo pedido (BD1+BD2)** → **semiautomática con confirmación**: ventana abierta = llave de correlación + popup por factura. No se usa hora (no existe) ni llave común.
3. **Datos de entrega** → se capturan **en el módulo de Pedidos** (búsqueda/alta en la tabla de clientes de Fast Order, alimentada por el registro QR). La integración con `TERCERO` de Millenium es fase futura.
4. **Fuente de captura** → **facturas** (`/crm/all/invoice`), no pedidos (Los Paisas no usa el documento "pedido").
5. **Una sola estación, varios borradores** → confirmado: Milena atiende varios clientes a la vez, por lo que se diseña una mesa multi-pedido. La concurrencia de varios operadores con el mismo vendedor queda fuera de alcance.
6. **`MAX_INVOICES = 4`** (heurística de Magic Paste en `consolidateOrder`) **no aplica** a la captura por API: un pedido puede tener las facturas que el operador confirme. El plan debe evitar reutilizar ese tope.
7. **Robustez operativa** → marca de agua por `NUMERO`, persistencia del borrador en Supabase y fallback "traer últimas facturas" son parte del alcance (blindajes acordados en la revisión de la lógica).

## Dependencias y pendientes

- **Millenium (cliente + Ricardo):** crear el **vendedor dedicado de Pedidos** en BD1 y BD2 y registrar su `ID_VENDEDOR` en la configuración.
- **Ricardo (bloqueo conocido):** credenciales de **BD2** para ejecución con las dos bases (ya en `.spec/integracion-api-2bd/`).
- **Opcional futuro (solo si se quiere automatización total):** hora real de la factura y/o campo de referencia en el payload.

## Siguiente paso

`plan.md` con el diseño técnico: migración SQL (`pedido_sessions`, `pedido_invoices` con RLS), tipos y funciones en `flex-crm.ts` (`getInvoices`/`getOneInvoice`), server action del poller acotado + marca de agua, estructura de la vista de Pedidos (popup + Realtime), mapeo factura→`orders` reutilizando el shape actual, extensión del ticket de impresión, y `tasks.md` atómico → implementación en Antigravity vía handoff. **Regla transversal:** cada tarea verifica que Despacho, Analytics, Imprimir y Magic Paste siguen intactos.
