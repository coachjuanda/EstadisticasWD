import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refresca la cookie de sesión de Supabase en cada request -- patrón
// estándar de @supabase/ssr para que el access token no expire a mitad de
// una visita sin que ningún Server Component lo note.
//
// Además, revisa profiles.status en cada request (no solo al login, como
// hacía antes /api/login). Antes de esto, un admin marcando a alguien
// "inactivo" no tenía efecto hasta que a esa persona se le venciera el
// access token y tuviera que volver a iniciar sesión -- con sesiones de
// varios meses ese hueco se vuelve enorme, así que la revisión se repite en
// cada visita, no solo una vez al iniciar sesión.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.status !== 'activo') {
    await supabase.auth.signOut();

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'Tu cuenta está inactiva, contacta al administrador del club.');
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
