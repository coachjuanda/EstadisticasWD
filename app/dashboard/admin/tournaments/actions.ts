'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/tournaments';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23503') {
    return 'No se puede eliminar: hay partidos o nóminas usando este torneo.';
  }
  return error.message;
}

function parseTournamentForm(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const league_id = formData.get('league_id') as string;
  const start_date = formData.get('start_date') as string;
  const end_date = formData.get('end_date') as string;
  const division_ids = formData.getAll('division_ids') as string[];
  const stat_definition_ids = formData.getAll('stat_definition_ids') as string[];

  return { name, league_id, start_date, end_date, division_ids, stat_definition_ids };
}

export async function createTournament(formData: FormData) {
  const { name, league_id, start_date, end_date, division_ids, stat_definition_ids } =
    parseTournamentForm(formData);

  if (!name || !league_id || !start_date || !end_date || division_ids.length === 0) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent(
        'Nombre, liga, fechas y al menos una división son obligatorios.'
      )}`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc('create_tournament_with_config', {
    p_name: name,
    p_league_id: league_id,
    p_start_date: start_date,
    p_end_date: end_date,
    p_division_ids: division_ids,
    p_stat_definition_ids: stat_definition_ids,
  });

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateTournament(formData: FormData) {
  const id = formData.get('id') as string;
  const { name, league_id, start_date, end_date, division_ids, stat_definition_ids } =
    parseTournamentForm(formData);

  if (!id || !name || !league_id || !start_date || !end_date || division_ids.length === 0) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent(
        'Nombre, liga, fechas y al menos una división son obligatorios.'
      )}`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc('update_tournament_with_config', {
    p_tournament_id: id,
    p_name: name,
    p_league_id: league_id,
    p_start_date: start_date,
    p_end_date: end_date,
    p_division_ids: division_ids,
    p_stat_definition_ids: stat_definition_ids,
  });

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteTournament(formData: FormData) {
  const id = formData.get('id') as string;

  const supabase = await createClient();
  const { error } = await supabase.from('tournaments').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
