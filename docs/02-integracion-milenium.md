# Integración Milenium — API Flex CRM

## Datos base

- **Base URL:** `https://me.services.ibla.co` · Docs vivas: `/crm/docs/` · Contrato: `docs/infra/flex-crm-openapi.yml`
- **Auth:** `POST /crm/empresa/login` → JWT (~15 días) que viaja en header `token`. Renovación: `POST /crm/empresa/token`.
- **Envelope:** `{ ok: true, data: [...] }` | `{ ok: false, message }`. Fechas `YYYY-MM-DD`.
- **Modelo 2 bases (acuerdo reunión 2026-07-11):** un usuario/login por base de datos.

| db_source | Base | Credencial (.env.local) |
|---|---|---|
| `01` | GRANESLOSPAISAS2021.FDB | `FLEX_CRM_EMAIL_01` / `FLEX_CRM_CLAVE_01` |
| `02` | PAISASFISCAL2021.FDB | `FLEX_CRM_EMAIL_02` / `FLEX_CRM_CLAVE_02` *(pendiente: Ricardo crea el usuario)* |

## Endpoints principales (ver OpenAPI para el detalle)

Clientes, Productos, Pedidos, Cartera, Facturas, Presupuesto, Cotizaciones, Observabilidad. **Solo lectura** — la API no permite escritura (el POST de clientes/pedidos hacia Milenium es fase 2, requiere desarrollo de Ricardo).

### ⚠️ Payload real de productos (verificado 2026-07-11 — el OpenAPI está desactualizado)

`POST /crm/all/product` devuelve `products: [{ producto: {...} }]` (anidado). Campos reales: `ID_ITEM`, `DESCRIPCION_ITEM`, `DESCRIPCION_ALTERNA`, `REFERENCIA`, `ID_CLASIFICACION`/`DESCRIPCION_CLASIFICACION`, `ID_MARCA_ITEM`/`DESCRIPCION_MARCA`, `ID_UNIDAD_COMPRA`/`DESCRIPCION_UNIDAD`, `COSTO_PROMEDIO`, proveedor (`ID/NOMBRE/SOURCE`), y **`stock: [{CANTIDAD, ID_BODEGA}]` (por bodega)**. `flex-crm.ts` desempaqueta y normaliza con `normalizeProduct()`.

Hallazgos de la prueba real (BD1: 2.145 productos): **no viene precio de venta** (solo costo) — preguntar a Ricardo cómo obtenerlo; **encoding roto** en tildes/eñes ("ALI◆OS" en vez de "ALIÑOS") — reportar; **latencia alta y variable** (12–34 s el catálogo completo, con un timeout intermitente) — preguntar por paginación/filtro incremental.

## Cliente en código

`src/lib/flex-crm.ts` — única puerta (constitución Art. 2). Estado: ✅ refactorizado (2026-07-11) — factoría `getFlexCrm(db)` con token independiente por base, helpers `getAllProductsUnified()` y `healthAll()`, compat con la API anterior (apunta a 01).

Consumidores: `src/app/api/milenium/{productos,clientes,health}/route.ts` y el futuro sync de inventario.

## Prueba de aceptación de BD2

Con cada token, `GET /crm/productos` debe devolver catálogos **distintos** (GRANES ≠ FISCAL). Si devuelven lo mismo, el usuario de BD2 quedó apuntando a la misma conexión — reportar a Ricardo.

## Infraestructura subyacente (contexto, no responsabilidad de la app)

La API llega a Firebird por un túnel SSH inverso desde el servidor del granero hacia `me.services.ibla.co:32045` (usuario `fb-granero-paisas`, puerto remoto 13053 → local 3050). Si la API responde error de conexión a BD:

1. Verificar en el servidor del granero la tarea programada `FB-Tunnel-fb-granero-paisas` y `C:\fb-granero-paisas\tunnel.log`.
2. Guía completa y scripts: `docs/infra/tunel-ssh.md` + `docs/infra/*.ps1`.
3. Lecciones aprendidas del túnel (abril 2026): la clave privada debe tener owner SYSTEM y ACL limpio; usar `127.0.0.1` (no `localhost`, resuelve a IPv6); el destino del forward es la IP del host Firebird.

⚠️ La clave del túnel fue expuesta en git (auditoría S1) — **debe rotarse**.

## Diccionario del ERP

- Resumen curado: `milenium-tables-dictionary.md` (TERCERO, PEDIDO, ITEM, KARDEX, BODEGA…)
- Listado completo (905 tablas): `docs/infra/milenium-schema-tablas.json`

## Acuerdos y pendientes con Ricardo

Registro cronológico en `docs/reuniones/`. Pendientes activos: creación usuario BD2 (con código de activación por correo, vence en 5 min — coordinar en vivo), existencias por bodega, escritura de terceros (fase 2), push por evento pedido/factura (fase 2), tema comercial del costo de la API.
