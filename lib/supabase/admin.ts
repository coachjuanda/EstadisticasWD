import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente con la service_role key: bypassa RLS por completo. SOLO se usa en
// código de servidor (route handlers, scripts) para operaciones puntuales
// que necesitan ver a través de RLS a propósito -- ej. resolver cedula ->
// email antes de que exista una sesión. Nunca se importa desde un componente
// de cliente ni se expone al navegador.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
