import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente con la anon key, atado a la sesión del usuario vía cookies.
// Respeta RLS normalmente -- este es el cliente que usa el resto de la app
// una vez el usuario ya inició sesión.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // set() puede fallar si se llama desde un Server Component sin
            // middleware de por medio -- no pasa nada si el middleware ya
            // está refrescando la sesión en cada request.
          }
        },
      },
    }
  );
}
