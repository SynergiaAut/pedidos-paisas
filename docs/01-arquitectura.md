# Arquitectura

## Flujo de datos (desde 2026-07-11)

```
┌─ Granero Los Paisas (Windows Server 2022) ─┐
│  Millenium Enterprise ── Firebird 2.5      │
│  (BD1 GRANES · BD2 FISCAL, puerto 3050)    │
│           │ túnel SSH inverso (infra)      │
└───────────┼────────────────────────────────┘
            ▼
   Servidor Milenium (me.services.ibla.co)
   API Flex CRM — JWT por empresa
            │  usuario BD1 ─┐
            │  usuario BD2 ─┤  pull HTTPS
            ▼               ▼
   ┌────────────────────────────────┐
   │ Next.js (Fast Order)           │
   │  src/lib/flex-crm.ts (única    │
   │  puerta a la API, 2 clientes)  │
   │  └─ sync → Supabase            │
   └────────────┬───────────────────┘
                ▼
   Supabase (Postgres+Auth+Realtime)
   orders · clients · inventory_* · …
                ▼
   UI: pedidos · despacho · inventario · CRM · cuadre
```

## Decisiones vigentes

1. **Monolito modular Next.js.** Server Actions para mutaciones (`src/app/actions/`), route handlers para integraciones (`src/app/api/milenium/*`). Sin backend separado — el volumen (cientos de pedidos/día) no lo justifica.
2. **API-only hacia Milenium** (constitución Art. 2). El túnel SSH es infraestructura del lado del servidor de Milenium — nuestra app no lo conoce; solo le importa que la API responda. Salud: `GET /api/milenium/health`.
3. **Supabase como sistema de registro propio.** Milenium sigue siendo la fuente de verdad contable; Supabase es la fuente de verdad operativa (estado del pedido, asignación de domiciliario, conteos). El inventario en Supabase es una **réplica de lectura** etiquetada con `db_source` + capa de conteo cíclico propia.
4. **Realtime para despacho e inventario** (suscripciones postgres_changes).
5. **Magic Paste** como puente humano mientras no exista push desde Milenium: el cajero copia el texto de la factura y el parser extrae número/valor/cliente.

## Estructura de src/

```
src/
├── app/
│   ├── actions/        # Server Actions (orders, crm, analytics, invoices, security)
│   ├── api/milenium/   # Route handlers de integración (productos, clientes, health)
│   ├── pedidos/ nuevo-pedido/ despacho*/ inventario/ crm/ cuadre/ analytics/
│   ├── registro/       # Form público QR
│   └── login/ signup/ activation/ admin/
├── components/         # UI por dominio (orders/, inventory/, crm/, ui/)
├── lib/
│   ├── flex-crm.ts     # ÚNICA puerta a la API Milenium
│   ├── supabase.ts     # cliente browser
│   └── utils.ts
├── utils/supabase/     # clientes SSR (client/server) + middleware auth
└── types/
```

## Histórico

`ADR_001_Architecture.md` (feb 2026) documenta la decisión original Next+Supabase+Magic Paste; sigue válido salvo que no contempla la integración Milenium. Las vías de integración descartadas están descritas en `_archive/LEAME.md`.
