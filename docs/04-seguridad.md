# Seguridad

## Secretos y variables de entorno

Todas en `.env.local` (gitignored, nunca commiteado — verificado en historial). Mantener `.env.example` sincronizado.

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (browser + SSR) |
| `FLEX_CRM_URL` | Base de la API Milenium |
| `FLEX_CRM_EMAIL_01` / `FLEX_CRM_CLAVE_01` | Credencial API BD1 (GRANES) |
| `FLEX_CRM_EMAIL_02` / `FLEX_CRM_CLAVE_02` | Credencial API BD2 (FISCAL) |

Reglas: la `service_role` key no se usa en la app ni se comparte con terceros; los JWT de Flex CRM viven solo en memoria del servidor (nunca en el cliente); no loguear tokens ni payloads con datos personales completos.

## Autenticación y roles

Supabase Auth + `middleware.ts` (SSR cookies). Roles en `profiles`: Admin, Cajero, Despachador; alta de usuarios con aprobación (status en profile) + licenciamiento (`software_licenses`).

## Riesgos abiertos (de la auditoría 2026-07-11 — resolver en este orden)

1. **Clave SSH del túnel expuesta en historial de git** → rotar con Ricardo; opcional purga con `git filter-repo`.
2. **RLS abierto**: `orders` con policies public, `clients` sin RLS. Diseño objetivo:
   - `orders`, `invoice_events`, `delivery_drivers`: CRUD solo `authenticated` (+ granularidad por rol si se requiere).
   - `clients`: select/update solo `authenticated`; insert anónimo únicamente vía RPC `register_client_v2` (`security definer`) con validación y unique por teléfono.
   - Staging de integraciones (si Milenium llegara a hacer push): tabla `milenium_*_raw` insert-only con key dedicada.
3. **Registro QR sin rate limit** → validación en RPC + captcha/turnstile si hay abuso.
4. **Firebird del cliente con contraseña de fábrica** (`masterkey`) → pedir cambio cuando Ricardo esté disponible (afecta su configuración de API).

## Datos personales (Ley 1581/2012)

`clients` contiene nombres, teléfonos y direcciones de personas: acceso mínimo necesario, no exportar sin autorización del titular del negocio, y los backups del ERP (`BK Paisas/*.FDB`) no deben vivir en carpetas sincronizadas/compartidas ni en el repo.

## Checklist antes de cada deploy

- [ ] `git status` sin secretos ni archivos del cliente
- [ ] RLS activo en tablas nuevas
- [ ] Ninguna query/policy `to public with check (true)` nueva
- [ ] `.env.example` actualizado si se agregó variable
