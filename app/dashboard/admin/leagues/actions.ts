'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/leagues';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23503') {
    return 'No se puede eliminar: hay torneos usando esta liga.';
  }
  if (error.code === '23505') {
    return 'Ya existe una liga con ese nombre.';
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

export async function createLeague(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();

  if (!name) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('El nombre es obligatorio.')}`);
  }

  const supabase = await createClient();
  const club_id = await getClubId(supabase);

  const { error } = await supabase.from('leagues').insert({ name, club_id });

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateLeague(formData: FormData) {
  const id = formData.get('id') as string;
  const name = (formData.get('name') as string)?.trim();

  if (!id || !name) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Datos incompletos.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('leagues').update({ name }).eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteLeague(formData: FormData) {
  const id = formData.get('id') as string;

  const supabase = await createClient();
  const { error } = await supabase.from('leagues').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
