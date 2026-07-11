# Pedidos Paisas — Guía maestra del proyecto

> **Este es el documento enrutador.** Léelo primero; según la tarea, sigue al documento puntual indicado en el mapa. No dupliques aquí detalle que vive en `docs/`.

## Qué es

"Fast Order": sistema de gestión de pedidos, despacho e inventario para el **Granero Los Paisas de Palmira**, corriendo en paralelo a su ERP **Millenium Enterprise** (Firebird). Cliente: Camilo (dueño). Contacto técnico ERP: Ricardo Murillo — Intelligent Business SAS (`rmurillo@ibla.co`).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS · Supabase (proyecto `zmkmmmhffoyqhpqenqru`: Postgres + Auth + Realtime) · Integración ERP vía **API Flex CRM** (`https://me.services.ibla.co`).

## Regla de oro de integración (decisión 2026-07-11)

**La única vía de datos hacia/desde Milenium es la API Flex CRM**, con **2 usuarios**: uno por base de datos (BD1 = GRANESLOSPAISAS, BD2 = PAISASFISCAL). El acceso directo Firebird, el worker de polling y el agente de spooler están **retirados** en `_archive/` — no los reactives ni los tomes como referencia. Ver `.spec/constitution.md`.

## Mapa de documentación

| Necesitas… | Documento |
|---|---|
| Reglas no negociables (SDD) | `.spec/constitution.md` |
| Spec de la fase actual (API 2 BDs) | `.spec/integracion-api-2bd/spec.md` |
| Arquitectura y flujo de datos | `docs/01-arquitectura.md` |
| Integración Milenium / API Flex CRM / túnel | `docs/02-integracion-milenium.md` |
| Esquema Supabase, tablas, RLS, migraciones | `docs/03-datos-supabase.md` |
| Seguridad y secretos | `docs/04-seguridad.md` |
| Módulo Pedidos (captura + Magic Paste) | `docs/modulos/pedidos.md` |
| Módulo Despacho (realtime + domiciliarios) | `docs/modulos/despacho.md` |
| Módulo Inventario (el bloqueado por la integración) | `docs/modulos/inventario.md` |
| Módulo CRM (clientes, RFM) | `docs/modulos/crm.md` |
| Módulo Cuadre diario | `docs/modulos/cuadre.md` |
| Registro de clientes por QR | `docs/modulos/registro-clientes.md` |
| Contrato OpenAPI de Flex CRM | `docs/infra/flex-crm-openapi.yml` |
| Diccionario de tablas del ERP Milenium | `milenium-tables-dictionary.md` + `docs/infra/milenium-schema-tablas.json` |
| Túnel SSH (infra del lado servidor) | `docs/infra/tunel-ssh.md` |
| Última auditoría técnica | `docs/auditorias/2026-07-11-auditoria.md` |
| Historial de reuniones con Ricardo | `docs/reuniones/` |
| Código retirado y por qué | `_archive/LEAME.md` |

## Convenciones para agentes

- **SDD estricto**: nueva funcionalidad = spec en `.spec/<feature>/` (spec → clarification → plan → tasks) antes de código. No saltarse pasos.
- Server Actions en `src/app/actions/` para mutaciones; el cliente Flex CRM vive solo en `src/lib/flex-crm.ts`.
- Nunca hardcodear secretos; variables en `.env.local` (ver `.env.example`).
- Nunca crear policies RLS `to public with check (true)` — ver `docs/04-seguridad.md`.
- No versionar `.bak`, dumps, claves ni datos del cliente.

## Comandos

```bash
npm run dev      # desarrollo (localhost:3000)
npm run build    # build de producción
npm run lint     # eslint
```

## Estado actual (actualizar al cerrar cada fase)

- ✅ Módulos pedidos/despacho/CRM/cuadre operando sobre Supabase.
- ✅ **Conexión API validada extremo a extremo (2026-07-11):** túnel arriba, BD1 respondiendo (2.145 productos normalizados con stock por bodega vía `/api/milenium/productos?db=01`). Smoke test: `node scripts/smoke-flex-crm.mjs`.
- 🔄 **Fase activa:** sync de inventario a `inventory_master`. Bloqueado solo por: credenciales BD2 (Ricardo) + clarifications del spec (precio de venta, encoding UTF-8, latencia). Spec: `.spec/integracion-api-2bd/`.
- ⏳ Fase 2: POST de clientes (registro QR → `TERCERO`), push en tiempo real de pedidos/facturas desde Milenium.
