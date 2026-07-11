# Constitución del Proyecto — Pedidos Paisas (Fast Order)

Reglas no negociables. Todo agente IA o desarrollador las respeta en cada decisión. Se modifica solo por decisión explícita de Johnathan.

## Artículo 1 — Stack (inmutable)
- Frontend/Backend: Next.js (App Router) + React + TypeScript + TailwindCSS. Monolito modular; no microservicios.
- Datos y auth: Supabase (Postgres + Auth + Realtime). Un solo proyecto: `zmkmmmhffoyqhpqenqru`.
- Estado cliente: Zustand + TanStack Query. UI: componentes propios + lucide-react.

## Artículo 2 — Integración Milenium (inmutable desde 2026-07-11)
- **Única vía de datos: API Flex CRM** (`me.services.ibla.co`), contrato en `docs/infra/flex-crm-openapi.yml`.
- Dos credenciales, una por base: `01` = GRANESLOSPAISAS, `02` = PAISASFISCAL. Todo dato importado lleva `db_source`.
- Prohibido: conexión directa a Firebird desde la app, drivers `node-firebird`/`pg` paralelos, scraping de spooler. Ese código vive en `_archive/` solo como referencia histórica.
- Todo acceso a la API pasa por `src/lib/flex-crm.ts`. Ningún componente o action llama `fetch` a la API directamente.
- Las sincronizaciones son idempotentes: upsert por clave natural (`sku`/`item` + `db_source`), nunca insert ciego.

## Artículo 3 — Seguridad (inmutable)
- Secretos solo en variables de entorno. `.env*` gitignored; `.env.example` siempre actualizado.
- Ninguna clave privada, backup `.FDB` ni dato personal del cliente se versiona.
- RLS habilitado en toda tabla con datos de negocio. Prohibido `to public with check (true)` salvo tablas de staging insert-only con justificación escrita.
- La `service_role` key nunca llega al cliente/navegador ni a terceros (Ricardo incluido). Integraciones externas entrantes = tablas de staging + key restringida, o Edge Function con validación.
- Datos de clientes (nombres, teléfonos, direcciones) sujetos a Ley 1581/2012: acceso mínimo necesario.

## Artículo 4 — Calidad (inmutable)
- TypeScript estricto; sin `any` nuevos en código de integración.
- Todo parser de texto (Magic Paste) y todo mapeo API→tabla tiene tests con casos reales antes de merge.
- Errores de integración se registran con contexto (endpoint, `db_source`, payload truncado) — nunca `catch` silencioso.
- No se versionan `.bak`, archivos de prueba sueltos ni artefactos de build.

## Artículo 5 — Proceso SDD (inmutable)
- Nueva funcionalidad o cambio estructural: `spec.md → clarification → plan.md → tasks.md` en `.spec/<feature>/` antes de escribir código.
- `CLAUDE.md` es el enrutador de documentación; se actualiza su sección "Estado actual" al cerrar cada fase.
- Los acuerdos con Ricardo/Milenium se registran en `docs/reuniones/` con fecha — la memoria del proyecto no vive en WhatsApp.

## Artículo 6 — Orientaciones (ajustables)
- Supabase Realtime para vistas operativas (despacho); polling solo si Realtime no aplica.
- El sync de inventario corre server-side (route handler + cron), no desde el navegador.
- Español para docs y dominio de negocio; inglés permitido en identificadores de código.
