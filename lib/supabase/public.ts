import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente anon puro, sin cookies ni sesión -- para la vista pública sin
// login. Solo puede leer lo que las vistas public_* exponen (RLS bloquea
// todo lo demás para el rol anon).
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
