# Módulo: Registro de clientes por QR

**Problema:** capturar datos de clientes nuevos en mostrador sin fricción: escanean un QR y se registran solos.

## Flujo

QR impreso → `/registro` (página pública, sin auth, layout propio) → formulario → `src/app/registro/actions.ts` → RPC `register_client_v2` → fila en `clients`.

## Archivos clave

`src/app/registro/{page.tsx,actions.ts,layout.tsx}`, `supabase/rpc_register_v2.sql`.

## ⚠️ Deuda de seguridad (auditoría S2/S6)

Para que el registro público funcionara se deshabilitó RLS en `clients` (`disable_rls_temp.sql`) tras una batalla con el schema cache (ver git log). Diseño objetivo: RLS habilitado, insert anónimo **solo** a través de la RPC (`security definer`) con validación de payload y unique por teléfono; select/update solo `authenticated`. Sin rate limit actualmente — agregar validación/captcha si hay abuso.

## Fase 2 (pendiente de Ricardo)

Replicar el registro hacia Milenium (`TERCERO` con `CLIENTE='SI'`, FKs requeridas: `ID_DEPTO`, `ID_CIUDAD`, `ID_TIPO_EMPRESA` — ver `milenium-tables-dictionary.md`) cuando la API permita escritura.
