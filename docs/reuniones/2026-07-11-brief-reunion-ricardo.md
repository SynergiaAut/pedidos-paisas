# Brief — Reunión con Ricardo (Milenium) · Sábado 11 jul 2026, 10:00 am

**Objetivo:** desbloquear la conexión a las 2 bases de datos Milenium para el módulo de inventario (necesidad más urgente de Camilo / Granero Los Paisas).

---

## 1. Contexto rápido

| Componente | Detalle |
|---|---|
| ERP cliente | Millenium Enterprise sobre **Firebird 2.5**, Windows Server 2022 (`190.108.77.142` / LAN `192.168.10.20`), puerto 3050 |
| Bases de datos | `C:\Millenium Enterprise\BD\GRANESLOSPAISAS2021.FDB` (empresa 01) y `PAISASFISCAL2021.FDB` (empresa 02) |
| API Flex CRM | `https://me.services.ibla.co` · docs en `/crm/docs/` · JWT vía `POST /crm/empresa/login` (usuario `lospaisasdepalmirasas@gmail.com`) · solo **consulta**: clientes, productos, pedidos, cartera, facturas, cotizaciones |
| Túnel SSH | Inverso, desde server del granero → `me.services.ibla.co:32045`, usuario `fb-granero-paisas`, puerto remoto `13053` → local `3050`. Tarea programada `FB-Tunnel-fb-granero-paisas` |
| Nuestra app | Next.js 14 + Supabase (`zmkmmmhffoyqhpqenqru`). Módulos: pedidos, despacho realtime, CRM, **inventario** (`inventory_master`, `inventory_counts`, `inventory_sessions`), cuadre, registro clientes por QR |
| Contacto | Ricardo Murillo — rmurillo@ibla.co (Intelligent Business SAS) |

## 2. Estado actual (cronología resumida)

- **8–16 abr:** contratación y activación de la API. Depuración larga del túnel SSH (permisos ACL de la clave, localhost→IPv6, IP privada vs pública, `AllowTcpForwarding remote`). El 16 abr Ricardo confirmó: **"ya están funcionando las peticiones"** ✅
- **30 abr:** reunión virtual de diseño con Ricardo.
- **12 may:** Ricardo dijo tener **lista la solución de push**: cada vez que se elabore un pedido o factura en Millenium, llama un servicio que guarda en nuestra BD. **No pudo probar porque el túnel estaba caído.**
- **21 may:** túnel levantado de nuevo. **Nunca se confirmó si funcionó la prueba** — este es el punto donde quedó todo.
- **26 may:** Camilo urge el módulo de inventario. Primera versión ya construida; solo falta la conexión para traer productos de las 2 BDs.
- **10 jun–fin jun:** Ricardo de vacaciones. **7 jul:** regresó; reunión pactada para hoy 10:00 am.

> Nota: hay 3 audios del 10 jul (PTT-20260710) sin transcribir; si contienen acuerdos, no están reflejados aquí.

## 3. Lo que ya tenemos construido (nuestro lado)

- Cliente Flex CRM (`src/lib/flex-crm.ts`) con auto-renovación de JWT + rutas `/api/milenium/productos`, `/clientes`, `/health`.
- Conexión directa Firebird (`src/lib/firebird.ts`) vía túnel para las 2 BDs (01 y 02).
- Módulo inventario con realtime y filtro por `db_source` ('01'/'02').
- Diccionario de tablas Milenium (`milenium-tables-dictionary.md`): `ITEM`, `PRECIO_ITEM`, `KARDEX`, `BODEGA`, `TERCERO`, `PEDIDO`… + esquema completo en `scripts/milenium_schema.json` (905 tablas).
- Backups `.FDB` locales (`BK Paisas/copia`) para pruebas sin tocar producción.
- Plan B: agente de telemetría por spooler de impresión (`milenium-agent/`) → tabla `milenium_telemetry`.

## 4. Agenda propuesta para la reunión

1. **Verificar túnel y API** (en vivo): tarea `FB-Tunnel-fb-granero-paisas` corriendo + login en `/crm/docs/`. Última verificación real fue el 21 may.
2. **Definir el mecanismo de integración de inventario** (decisión clave):
   - **A. Push desde Milenium a Supabase** (lo que Ricardo dijo tener listo el 12 may) — es la idea de hoy: darle acceso/endpoint.
   - **B. Pull vía API Flex CRM** (productos/existencias).
   - **C. Consulta directa Firebird por el túnel** (ya implementada en nuestro código).
   - Ojo: el push por evento (pedido/factura) **no cubre todos los movimientos de stock** (compras, ajustes, devoluciones). Probablemente se necesite A + un sync periódico de existencias.
3. **Estructura de tablas**: pedir a Ricardo los campos exactos que enviará (por BD), para mapear/homogeneizar contra `inventory_master` (sku, barcode, description, stock, price, db_source).
4. **Cobertura de las 2 bases**: confirmar que tanto la API como el push manejan GRANES (01) **y** FISCAL (02), y cómo se selecciona la empresa.
5. **POST de clientes**: la API hoy es solo lectura — ¿pueden habilitar escritura a `TERCERO` para el registro por QR?
6. **Pedidos**: agrupación de múltiples facturas en un mismo pedido y flujo con domiciliarios.
7. **Tema comercial**: Los Paisas pagan la API desde abril sin beneficio; Ricardo dijo (19 jun) que "el valor lo podemos cuadrar después" — dejarlo por escrito.

## 5. Puntos a tener en cuenta / riesgos

- **Acceso a Supabase para Ricardo — no dar llaves completas.** Propuesta: tabla(s) de staging (`milenium_products_raw`, `milenium_stock_raw`, `milenium_orders_raw`) con política de **solo INSERT/UPSERT** usando una API key restringida por RLS (mismo patrón de `milenium_telemetry`). Nosotros procesamos de staging → `inventory_master`. Nunca entregar `service_role`.
- **Idempotencia:** upsert por `(sku, db_source)` con timestamp, para reintentos sin duplicados.
- **Discrepancia de puerto:** `.env` usa `FIREBIRD_PORT=13054` pero manual y chat dicen `13053`. Validar cuál quedó activo.
- **Historial de demoras de Ricardo:** cerrar la reunión con entregables concretos, responsable y fecha (ej.: "estructura de campos el lunes", "primera prueba de push el miércoles"). No salir de la reunión sin la primera prueba agendada.
- **Antes de la reunión (5 min):** confirmar en el server del granero que la tarea del túnel está corriendo y probar login a la API — evita perder la reunión en diagnóstico.

## 6. Preguntas puntuales para Ricardo

1. ¿El túnel responde hoy desde su lado? (`ss -tlnp | grep 13053`)
2. ¿Su servicio de push ya está desarrollado? ¿Qué payload y campos envía por evento?
3. ¿El push dispara también con movimientos de inventario o solo pedido/factura?
4. ¿La API puede exponer existencias por bodega (`BODEGA`, `KARDEX`) de ambas empresas?
5. ¿Pueden habilitar creación de terceros (clientes) vía API?
6. ¿Milenium agrupa varias facturas bajo un pedido? ¿Con qué campo se relacionan (`PEDIDO.NUMERO` ↔ `FACTURA`)?
