'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/teams';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23503') {
    return 'No se puede eliminar: hay nóminas o partidos usando este equipo.';
  }
  if (error.code === '23505') {
    return 'Ya existe un equipo con ese nombre.';
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

// El equipo hereda el deporte de su división -- no se pide aparte en el
// formulario para que no puedan quedar desalineados (un equipo de hockey en
// hielo en una división de hockey en línea, por ejemplo).
async function getDivisionSport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  divisionId: string
) {
  const { data: division, error } = await supabase
    .from('divisions')
    .select('sport')
    .eq('id', divisionId)
    .single();

  if (error || !division) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('La división seleccionada no existe.')}`);
  }

  return division.sport as string;
}

export async function createTeam(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const division_id = formData.get('division_id') as string;

  if (!name || !division_id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Nombre y división son obligatorios.')}`);
  }

  const supabase = await createClient();
  const club_id = await getClubId(supabase);
  const sport = await getDivisionSport(supabase, division_id);

  const { error } = await supabase.from('teams').insert({ name, division_id, sport, club_id });

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateTeam(formData: FormData) {
  const id = formData.get('id') as string;
  const name = (formData.get('name') as string)?.trim();
  const division_id = formData.get('division_id') as string;

  if (!id || !name || !division_id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Datos incompletos.')}`);
  }

  const supabase = await createClient();
  const sport = await getDivisionSport(supabase, division_id);

  const { error } = await supabase
    .from('teams')
    .update({ name, division_id, sport })
    .eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteTeam(formData: FormData) {
  const id = formData.get('id') as string;

  const supabase = await createClient();
  const { error } = await supabase.from('teams').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
