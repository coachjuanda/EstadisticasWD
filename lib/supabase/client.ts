import { createBrowserClient } from '@supabase/ssr';

// Cliente de navegador: comparte la sesión (cookies) con el server client de
// @supabase/ssr. Se usa donde un tap necesita reflejarse al instante sin un
// round-trip completo por Next.js (el marcador en vivo del scorekeeper) --
// para todo lo demás, el server client sigue siendo la opción por defecto.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
