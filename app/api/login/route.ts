import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { cedula, password } = await request.json();

  if (typeof cedula !== 'string' || typeof password !== 'string' || !cedula || !password) {
    return NextResponse.json({ error: 'Cédula y contraseña son obligatorias.' }, { status: 400 });
  }

  // service_role: la única forma de resolver cedula -> email es bypassando
  // RLS de profiles, y eso NUNCA pasa por el navegador. El cliente solo
  // manda cedula+password; el email real no se le devuelve ni se expone.
  const admin = createAdminClient();

  const { data: profile, error: lookupError } = await admin
    .from('profiles')
    .select('email, status')
    .eq('cedula', cedula)
    .maybeSingle();

  if (lookupError || !profile) {
    // Mismo mensaje exista o no la cédula, para no dejar enumerar cédulas
    // válidas por fuerza bruta contra este endpoint.
    return NextResponse.json({ error: 'Cédula o contraseña incorrecta.' }, { status: 401 });
  }

  // Cliente atado a cookies: signInWithPassword aquí sí deja la sesión
  // seteada como cookie httpOnly en la respuesta, lista para que el resto de
  // la app (Server Components, RLS) la use en el siguiente request.
  const supabase = await createClient();

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (signInError || !signInData.session) {
    return NextResponse.json({ error: 'Cédula o contraseña incorrecta.' }, { status: 401 });
  }

  // El chequeo de estado va DESPUÉS de validar la contraseña a propósito:
  // así "cuenta inactiva" solo se le revela a alguien que ya demostró
  // conocer la contraseña correcta, no a cualquiera tanteando cédulas.
  if (profile.status !== 'activo') {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'Tu cuenta está inactiva, contacta al administrador del club.' },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true });
}
