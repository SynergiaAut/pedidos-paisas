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
| Spec de conteo móvil por link (TASK-011, lista para Antigravity) | `.spec/conteo-movil/spec.md` |
| Spec de dashboard de consolidados de conteos (lista para Antigravity) | `.spec/dashboard-conteos/spec.md` |
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
| Red Mikrotik: acceso WiFi → Fast Order (conteo móvil) | `docs/infra/red-mikrotik-conteo-movil.md` |
| Última auditoría técnica | `docs/auditorias/2026-07-11-auditoria.md` |
| Lecciones aprendidas | `docs/lecciones-aprendidas.md` |
| **Roadmap priorizado** (qué sigue y por qué) | `docs/roadmap.md` |
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
- ✅ **Módulo inventario operando con BD1 (2026-07-11):** sync API→`inventory_master` (2.145 ítems/451 servicios), botón Sincronizar en UI, stats reales, RLS cerrado + middleware global (migraciones 009–013). Falta solo credenciales BD2 para `{"db":"all"}`.
- ✅ **TASK-011 — Conteo móvil por link (2026-07-12):** Implementación completa incluyendo el fix de `APP_BASE_URL` para enlaces de bodega estables, y correcciones post-prueba real de reactividad en tiempo real (Supabase Realtime) y visualización de unidades de medida (`unit`) en bodega móvil.
- ✅ **Dashboard de consolidados de sesiones de inventario (2026-07-12):** Nueva pestaña de "Análisis" en `/inventario` con cobertura de catálogo físico, gráficos de tendencias de descuadres en el tiempo usando Recharts, historial de sesiones agregadas y ranking de productos problemáticos (frecuencia/costo). Integrada actualización síncrona de `physical_stock`/`last_counted_at` en el catálogo unificado.
- ✅ **Blindaje de confiabilidad de datos en Valorización (2026-07-12):** limpieza de sesiones de prueba sembradas; exclusión de outliers de `cost_avg` corruptos del ERP; disclosure dinámico de % de catálogo sin costo y de alcance BD1-only en la UI.
- ✅ **Fix real de encoding UTF-8/mojibake (2026-07-12/13):** el fallback anterior (`flex-crm.ts`) re-decodificaba TODA la respuesta de `/crm/all/product` como windows-1252 si un solo producto traía un byte inválido, dañando la "Ñ" de productos que sí venían en UTF-8 válido (ej. "BOCADILLO VELEÃ'O"). Corregido con decodificación UTF-8 siempre + `repairMojibake()` dirigida por campo en `inventory-mapper.ts`. Verificado con re-sync completo de BD1 (ALIÑO/VELEÑO/GUARAQUEÑO correctos). Auditoría sistemática de `cost_avg` confirma **exactamente 3 productos** con costo corrupto en el ERP, estables entre syncs (no es bug de cálculo nuestro): SKU 2202007 (+$50.17 billones COP), SKU 701042 (-$24.69 billones COP), SKU 606042 (-$952.329,10 COP). Ver `docs/reuniones/2026-07-12_costo_promedio_outliers.md`.
- ✅ **Usabilidad del dashboard tras uso real (2026-07-13):** Historial de Sesiones con categoría + drill-down clickeable al detalle de cada sesión; KPI "Conteos Pendientes" navegable (abre/reanuda la sesión); botón "Historial" funcional; tarjetas más compactas.
- ✅ **Sync automático cada 15 min (2026-07-13):** implementado vía `instrumentation.ts` + `node-cron` (sin contenedor adicional), reutilizando `runInventorySync()`. Acota (no elimina) la ventana de stock desactualizado durante conteos en horario de venta.
- ✅ **Reconciliación de descuadre al cierre de sesión (2026-07-13):** al cerrar cualquier sesión de conteo, se consulta el stock fresco de Milenium (`getOneProduct`) por cada SKU contado; si cambió desde que se contó (venta u otro movimiento durante la sesión), se recalcula el descuadre contra ese valor y se deja nota de auditoría visible ("Reconciliado") en el detalle de la sesión. Limitación conocida: la API de Milenium no expone detalle de línea por SKU en pedidos/facturas, así que el ajuste se infiere del delta de stock, no de una venta específica confirmada — pendiente pedirle a Ricardo un endpoint con ese detalle para atribución exacta.
- 🔄 **Pendientes con Ricardo:** usuario BD2, precio de venta en payload, paginación/latencia, endpoint con detalle de línea (item+cantidad) en pedidos/facturas para reconciliación exacta, **3 valores `cost_avg` corruptos en el ERP** (SKU 2202007, 701042, 606042 — ver hallazgo arriba, con evidencia de estabilidad para descartar bug de nuestro conector). Spec: `.spec/integracion-api-2bd/`.
- ⏳ Fase 2: POST de clientes (registro QR → `TERCERO`), push en tiempo real de pedidos/facturas desde Milenium.
