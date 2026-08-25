'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/divisions';

// RLS ya exige rol admin + club_id propio para insert/update/delete en
// divisions -- esta capa no repite ese chequeo, solo traduce errores de
// Postgres a mensajes legibles.
function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23503') {
    return 'No se puede eliminar: hay equipos usando esta división.';
  }
  if (error.code === '23505') {
    return 'Ya existe una división con ese nombre.';
  }
  return error.message;
}

async function getClubId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('club_id')
    .eq('id', user.id)
    .single();

  return profile?.club_id as string;
}

export async function createDivision(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const sport = formData.get('sport') as string;

  if (!name || !sport) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Nombre y deporte son obligatorios.')}`);
  }

  const supabase = await createClient();
  const club_id = await getClubId(supabase);

  const { error } = await supabase.from('divisions').insert({ name, sport, club_id });

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateDivision(formData: FormData) {
  const id = formData.get('id') as string;
  const name = (formData.get('name') as string)?.trim();
  const sport = formData.get('sport') as string;

  if (!id || !name || !sport) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Datos incompletos.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('divisions').update({ name, sport }).eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteDivision(formData: FormData) {
  const id = formData.get('id') as string;

  const supabase = await createClient();
  const { error } = await supabase.from('divisions').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
