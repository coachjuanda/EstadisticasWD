import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { cedula, password } = await request.json();

  if (typeof cedula !== 'string' || typeof password !== 'string' || !cedula || !password) {
    return NextResponse.json({ error: 'Cédula y contraseña son obligatorias.' }, { status: 400 });
  }

  // service_role: la única forma de resolver cedula -> email es bypassando
  // RLS de people, y eso NUNCA pasa por el navegador. El cliente solo manda
  // cedula+password; el email real no se le devuelve ni se expone.
  const admin = createAdminClient();

  const { data: person, error: lookupError } = await admin
    .from('people')
    .select('email, status')
    .eq('cedula', cedula)
    .maybeSingle();

  if (lookupError || !person) {
    // Mismo mensaje exista o no la cédula, para no dejar enumerar cédulas
    // válidas por fuerza bruta contra este endpoint.
    return NextResponse.json({ error: 'Cédula o contraseña incorrecta.' }, { status: 401 });
  }

  // Cliente atado a cookies: signInWithPassword aquí sí deja la sesión
  // seteada como cookie httpOnly en la respuesta, lista para que el resto de
  // la app (Server Components, RLS) la use en el siguiente request.
  const supabase = await createClient();

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: person.email,
    password,
  });

  if (signInError || !signInData.session) {
    return NextResponse.json({ error: 'Cédula o contraseña incorrecta.' }, { status: 401 });
  }

  // El chequeo de estado va DESPUÉS de validar la contraseña a propósito:
  // así "cuenta inactiva" solo se le revela a alguien que ya demostró
  // conocer la contraseña correcta, no a cualquiera tanteando cédulas.
  if (person.status !== 'activo') {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'Tu cuenta está inactiva, contacta al administrador del club.' },
      { status: 403 }
    );
  }

  // Si tiene más de un rol, no entra directo -- primero elige con cuál
  // (set_active_membership ya dejó activo el último que usó, así que si
  // solo tiene 1 rol no hace falta tocar nada acá). Filtro por person_id
  // obligatorio: "memberships: admin manages own club" (RLS) deja a un admin
  // leer TODAS las membresías de su club, no solo la suya -- sin este
  // filtro, cualquier admin con más de 1 persona en su club vería el
  // selector de rol así tuviera un solo rol.
  const { count: membershipCount } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', signInData.session.user.id);

  return NextResponse.json({ success: true, needsRoleSelection: (membershipCount ?? 0) > 1 });
}
