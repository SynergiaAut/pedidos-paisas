# Módulo: Pedidos (captura)

**Problema:** capturar en segundos los pedidos que el cajero factura en Milenium, sin re-digitar.

## Flujo

1. Cajero factura en Milenium → copia el texto del recibo (Ctrl+C).
2. En `/nuevo-pedido`, "Magic Paste" (`src/components/sequential-paste.tsx`, `InvoiceCaptureModal`) parsea con regex: número de factura (`F-12345`), valor (`$XX.XXX`), cliente (heurística).
3. Se crea `orders` con `public_id` (PED-XXXX), `invoices_data` jsonb y `products` jsonb.
4. Si el cliente ya tiene pedido activo, `consolidateOrder` (en `src/app/actions/orders.ts`) fusiona facturas — **máximo 4 por pedido** (`MAX_INVOICES`).

## Archivos clave

- `src/app/nuevo-pedido/page.tsx`, `src/app/pedidos/page.tsx`, `src/app/pedidos/imprimir/[id]/`
- `src/app/actions/orders.ts` (crear, consolidar), `src/app/actions/invoices.ts` (ciclo de `invoice_events`)
- `src/components/orders/` (ConsolidateOrderBanner, InvoiceCaptureModal)

## Datos

`orders` (status TOMADO→DESPACHO→PAGADO), `invoice_events` (PENDING→PROCESSING→procesado/ignorado).

## Reglas de negocio

- Un pedido puede agrupar varias facturas (limitación de Milenium: pedidos grandes salen en varias facturas).
- El parser es el punto más frágil del módulo: **cualquier cambio requiere tests con textos de factura reales** (constitución Art. 4).

## Pendiente

- Fase 2: reemplazar/complementar Magic Paste con push automático desde Milenium por evento de facturación.
