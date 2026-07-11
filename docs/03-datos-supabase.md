# Datos — Supabase

**Proyecto:** `zmkmmmhffoyqhpqenqru` (`NEXT_PUBLIC_SUPABASE_URL=https://zmkmmmhffoyqhpqenqru.supabase.co`).

## Tablas por dominio

| Tabla | Dominio | Notas |
|---|---|---|
| `orders` | Pedidos/Despacho | Núcleo operativo. `public_id` (PED-XXXX), `status` (TOMADO→DESPACHO→PAGADO), `invoices_data` jsonb (máx. 4 facturas consolidadas), `products` jsonb, `delivery_type`, driver. Realtime habilitado. |
| `clients` | CRM | Clientes propios (no confundir con `TERCERO` de Milenium). Registro público por QR. Unique por `phone`. |
| `client_notes`, `client_tags`, `client_interactions` | CRM | Anexos del cliente. |
| `invoice_events` | Pedidos | Eventos de captura de facturas (PENDING→PROCESSING→procesado/ignorado). |
| `delivery_drivers` | Despacho | Domiciliarios. |
| `profiles` | Auth | Perfil + rol (Admin/Cajero/Despachador) + status. |
| `software_licenses` | Licenciamiento | RPC `activate_license`. |
| `inventory_master` | Inventario | Réplica de catálogo/stock por `db_source` ('01'/'02'). Destino del sync API. Realtime. |
| `inventory_counts`, `inventory_sessions` | Inventario | Conteo cíclico propio. |
| `milenium_telemetry` | LEGACY | Del agente de spooler archivado. Candidata a drop cuando se confirme que nada la lee. |

RPCs relevantes: `update_all_rfm_scores`, `calculate_daily_metrics`, `calculate_client_retention`, `activate_license`, `register_client_v2`.

## ⚠️ Estado de migraciones — deuda conocida (auditoría A4)

`supabase/migrations/001–008` + ~10 SQL sueltos de hotfixes (`fix_permissions_final.sql`, `disable_rls_temp.sql`, `rpc_register_v2.sql`, …). **No se sabe con certeza cuáles están aplicados.** Además, `inventory_master/counts/sessions` se crearon directo en el dashboard y no tienen migración.

Plan: `supabase db pull` para generar baseline del esquema real → borrar los sueltos → desde ahí, toda alteración vía migración numerada.

## ⚠️ RLS — deuda crítica (auditoría S2)

`orders` tiene policies `to public` (select/insert/update) y `clients` tiene RLS deshabilitado por `disable_rls_temp.sql`. Objetivo: policies por rol autenticado; el insert anónimo del registro QR pasa solo por RPC `register_client_v2` con validación. Ver `docs/04-seguridad.md`.
