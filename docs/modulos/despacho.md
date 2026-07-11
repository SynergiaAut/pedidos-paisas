# Módulo: Despacho

**Problema:** coordinar en tiempo real la asignación de pedidos a domiciliarios entre cajero y despachador.

## Flujo

Pedido en estado TOMADO aparece en la vista de despacho → se asigna domiciliario (`delivery_drivers`) → pasa a DESPACHO → al retornar/pagar pasa a PAGADO. La vista se actualiza por **Supabase Realtime** (`orders` está en `supabase_realtime`), sin refrescar.

## Archivos clave

- Vista de pedidos/despacho: `src/app/pedidos/page.tsx` (la página `despacho/` original fue absorbida; su `.bak` se eliminó en la depuración 2026-07-11).
- `src/components/DriversManagementModal.tsx`, `src/components/orders/ReassignDriverModal.tsx`, `src/components/ui/DriverSelector.tsx`.
- `delivery_type` en orders (domicilio/recoge) — migración 004.

## Datos

`orders.status`, `orders.delivery_type`, `delivery_drivers`.

## Reglas de negocio

- Reasignación de domiciliario permitida mientras el pedido no esté PAGADO.
- El rendimiento por domiciliario se reporta en Analytics (`getDriverPerformance`).
