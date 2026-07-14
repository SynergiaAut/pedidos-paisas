# SPEC (OPS): Auditar/versionar esquema + validar sincronización con GitHub antes de desplegar
> Generado: 2026-07-13
> Proyecto: Fast Order (Pedidos Paisas)
> Handoff: Claude/Cowork → Antigravity
> Relacionado: migración `supabase/migrations/020_fix_clients_crm_columns.sql` (creada en esta sesión)

---

## 0. PASO PREVIO — Confirmar accesos (no continuar sin esto)

Antes de ejecutar, confirmar que esta sesión de Antigravity tiene:
- **Acceso de escritura a la BD de Supabase** del proyecto de producción (Fast_Order_DB / Nano) para aplicar migraciones.
- **Acceso push a GitHub** (`github.com/SynergiaAut/pedidos-paisas`, rama `main`).

Si falta alguno, detenerse y avisar; no simular el paso.

---

## 1. CONTEXTO (qué se descubrió)

- El CRM lanza `42703 (undefined_column)` al abrir. **Causa raíz:** la migración a *Fast_Order_DB (Nano)* dejó deriva de esquema — columnas de `public.clients` (`status`, `lifetime_value`, `average_order_value`, `rfm_segment`, `rfm_score`, `last_interaction_date`) y la función `calculate_rfm_score` **nunca estuvieron versionadas** (existían solo en la base anterior) y no se recrearon.
- Ya existe la migración `020_fix_clients_crm_columns.sql` que agrega esas columnas, reasegura `orders.client_id` y recrea el trigger de métricas (con la llamada a `calculate_rfm_score` protegida). **Falta aplicarla** y reconstruir la función RFM.
- **Estado del repo (al 2026-07-13):** rama `main`, **2 commits por delante** de `origin/main` y **~68 cambios sin commitear**. Hay drift local vs GitHub que debe resolverse antes de desplegar.
- Despliegue por **Docker** (`Dockerfile` + `docker-compose.yml`) en el Windows Server del granero.

## 2. CONSTITUTION (aplicable)

- **Secretos solo en variables de entorno; nada de claves versionadas** (Art. 3). Ningún token/credencial en URLs, código ni commits.
- **Esquema reproducible por migraciones idempotentes tracked** (Art. 2 y 5): todo objeto de BD debe poder recrearse desde el repo. Esta tarea nace precisamente porque eso se rompió.
- No romper módulos existentes (inventario, pedidos, despacho, cuadre).

## 3. TASKS

### G1 — [SEGURIDAD · P0] Rotar el token de GitHub y sacarlo del remoto
El remoto `origin` tiene un **PAT de GitHub (`ghp_…`) en texto plano** embebido en la URL (visible en `git remote -v`). Aunque vive en `.git/config` local (no se sube), quedó expuesto.
- **Rotar/revocar** ese PAT en GitHub (Settings → Developer settings → Tokens) y generar uno nuevo.
- Reconfigurar el remoto **sin el token en la URL**: usar **SSH** (`git@github.com:…`) o un **credential helper** (Git Credential Manager). Ej.: `git remote set-url origin git@github.com:SynergiaAut/pedidos-paisas.git`.
- Verificar que ningún archivo del repo contenga tokens (`git grep -nE "ghp_|ghs_|github_pat_"`).
- **Resultado:** el token viejo queda inválido y el nuevo no vive en texto plano en la URL.

### G2 — [Esquema · P0] Aplicar 020 y auditar la BD nueva contra el código
- Aplicar `supabase/migrations/020_fix_clients_crm_columns.sql` en Fast_Order_DB.
- Verificar que el CRM carga sin `42703` (listado, filtros por segmento, detalle de cliente).
- **Auditar tabla por tabla** que la BD nueva tenga TODO lo que el código espera: `clients` (+ interacciones), `client_interactions`, `client_notes`, `client_tags`, `orders` (+ `client_id`), `delivery_drivers`, `inventory_master`, `inventory_sessions`, `inventory_counts`, `pedido_sessions`, `pedido_invoices`, y las tablas/funciones/triggers de conteo móvil y reconciliación. Revisar también **RLS** y las **publicaciones de `supabase_realtime`** (despacho, inventario, `pedido_invoices`).
- **Resultado:** inventario tabla-por-tabla de faltantes (columnas, funciones, triggers, políticas, realtime) con evidencia.

### G3 — [Esquema · P1] Reconstruir/versionar todo el esquema faltante
- Reconstruir la función **`calculate_rfm_score(uuid)`** (recuperar de la base anterior si sigue accesible; si no, implementar una **segmentación RFM estándar** por recencia/frecuencia/monto que llene `rfm_score` y `rfm_segment`).
- Crear migraciones **tracked e idempotentes** (021, 022…) para cualquier objeto que hoy solo exista en la BD y no en el repo, hasta que **la BD sea 100% reproducible desde `supabase/migrations/`**.
- **Resultado:** clonar la Bda desde cero con las migraciones deja el esquema idéntico al de producción.

### G4 — [Sync GitHub · P0] Poner GitHub al día antes de desplegar
- Revisar los ~68 cambios pendientes (`git status`) y agruparlos en **commits lógicos** (fixes de pedidos, migración 020, ticket/observaciones, specs/handoffs, limpieza de SQL legacy). Mensajes claros.
- Confirmar que los **2 commits locales adelantados** son correctos y **hacer push** de todo a `origin/main`.
- Verificar **working tree limpio** y **`main` == `origin/main`** (`git status -sb` sin diferencias). Revisar que `.gitignore` cubra `.env*`, dumps y artefactos (Art. 3/4).
- **Resultado:** GitHub refleja exactamente el estado local validado; base sólida para desplegar.

### G5 — [Deploy · P1] Validar el flujo de despliegue en el servidor
- Documentar/verificar el flujo real: en el Windows Server → `git pull` de `origin/main` → `docker compose build` → `docker compose up -d` (o el que apliquen).
- Confirmar variables de entorno de producción presentes en el servidor (`.env`/compose): Supabase (URL/keys), Flex CRM (BD1; BD2 cuando exista), `PEDIDOS_ID_VENDEDOR`, datos de empresa del ticket (`NEXT_PUBLIC_EMPRESA_*`).
- **Smoke test post-deploy:** health de la app, CRM carga sin error, inventario sincroniza, crear un pedido de prueba, imprimir ticket.
- **Resultado:** despliegue reproducible y checklist post-deploy que pasa.

## 4. CONTEXTO PARA ANTIGRAVITY

### Keywords para el KM
- supabase migracion Fast_Order_DB deriva esquema
- clients rfm_segment lifetime_value calculate_rfm_score 42703
- git remote token PAT credential helper ssh
- docker compose deploy windows server pull
- supabase_realtime publicacion RLS auditoria

### Archivos relevantes
- `supabase/migrations/020_fix_clients_crm_columns.sql` — fix ya creado (aplicar)
- `supabase/002_link_orders_to_clients.sql` — trigger de métricas (referencia; columnas/función que faltaban)
- `supabase/schema_clients.sql`, `supabase/update_clients_schema.sql` — esquema base de clients (incompleto)
- `src/app/actions/crm.ts` — consultas del CRM que fallan por columnas faltantes
- `Dockerfile`, `docker-compose.yml` — despliegue
- `.spec/constitution.md` — Art. 2/3/5 (idempotencia, secretos, SDD)

### Próximo paso recomendado
Ejecutar en orden: **G1 (rotar token) → G2 (aplicar 020 + auditar) → G4 (sync GitHub)**; luego G3 (RFM + esquema completo) y G5 (deploy). No desplegar hasta que G2 y G4 estén verdes.
