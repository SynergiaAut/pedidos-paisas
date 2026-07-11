# Módulo: CRM

**Problema:** conocer y segmentar los clientes propios del granero (quién compra, cuánto, con qué frecuencia) para gestión comercial.

## Funcionalidad

- Directorio de clientes (`/crm`) con búsqueda, filtros y paginación; ficha por cliente (`/crm/[id]`) con historial de pedidos, notas, tags e interacciones.
- **Segmentación RFM** (Recency/Frequency/Monetary): RPC `update_all_rfm_scores`, badge en `src/components/crm/RFMBadge.tsx`, stats en `getRFMSegmentationStats`.
- Alta manual (`CreateClientModal`) y vínculo pedido↔cliente (migración 002).
- Analytics de clientes: top clients, retención (`calculate_client_retention`), distribución por fuente.

## Archivos clave

`src/app/crm/*`, `src/app/actions/crm.ts` (lecturas), `src/app/actions/crm-mutations.ts` (create/update/delete), `src/components/crm/`, `src/components/ClientSearch.tsx`.

## Datos

`clients` (unique por `phone`), `client_notes`, `client_tags`, `client_interactions`.

## Relación con Milenium

`clients` es independiente de `TERCERO` (Milenium). Fase 2: sincronizar registro QR → `TERCERO` vía API cuando Ricardo habilite escritura. Mientras tanto puede haber duplicidad conceptual cliente-app vs cliente-ERP: la conciliación se hará por teléfono/NIT.
