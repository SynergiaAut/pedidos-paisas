import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente Supabase para componentes cliente ('use client').
 *
 * IMPORTANTE (fix 2026-07-11): antes era un createClient plano de supabase-js,
 * que NO compartía la sesión del login (cookies SSR). Con RLS activo, las
 * consultas salían como `anon` y las tablas protegidas devolvían 0 filas.
 * createBrowserClient (de @supabase/ssr) usa las mismas cookies que el login
 * y el middleware, así que las consultas van como `authenticated`.
 */
export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
