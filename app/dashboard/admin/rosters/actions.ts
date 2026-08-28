'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/rosters';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23505') {
    return 'Ese equipo ya tiene una nómina en ese torneo, o ese deportista ya está en esta nómina.';
  }
  if (error.code === '23503') {
    return 'No se puede eliminar: hay partidos usando esta nómina.';
  }
  return error.message;
}

export async function createRoster(formData: FormData) {
  const team_id = formData.get('team_id') as string;
  const tournament_id = formData.get('tournament_id') as string;

  if (!team_id || !tournament_id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Equipo y torneo son obligatorios.')}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('rosters')
    .insert({ team_id, tournament_id })
    .select('id')
    .single();

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?roster=${data.id}`);
}

export async function deleteRoster(formData: FormData) {
  const id = formData.get('id') as string;

  const supabase = await createClient();
  const { error } = await supabase.from('rosters').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function addRosterPlayers(formData: FormData) {
  const roster_id = formData.get('roster_id') as string;
  const playersJson = formData.get('players_json') as string;

  if (!roster_id || !playersJson) {
    redirect(`${BASE_PATH}?roster=${roster_id}&error=${encodeURIComponent('Elige al menos un deportista.')}`);
  }

  let players: { athlete_id: string; jersey_number: number | null }[];
  try {
    players = JSON.parse(playersJson);
  } catch {
    redirect(`${BASE_PATH}?roster=${roster_id}&error=${encodeURIComponent('Datos inválidos.')}`);
  }

  if (!Array.isArray(players) || players.length === 0) {
    redirect(`${BASE_PATH}?roster=${roster_id}&error=${encodeURIComponent('Elige al menos un deportista.')}`);
  }

  const supabase = await createClient();
  const { data: roster } = await supabase.from('rosters').select('team_id').eq('id', roster_id).single();

  const { error } = await supabase
    .from('roster_players')
    .insert(players.map((p) => ({ roster_id, athlete_id: p.athlete_id, jersey_number: p.jersey_number })));

  if (error) {
    redirect(`${BASE_PATH}?roster=${roster_id}&error=${encodeURIComponent(friendlyError(error))}`);
  }

  // Alta automática a team_members (membresía vigente para convocatoria a
  // entrenamientos) -- competir en esta nómina de torneo implica que
  // también entrena con el equipo. ignoreDuplicates: ya puede estar ahí de
  // una nómina anterior, no es un error.
  if (roster?.team_id) {
    await supabase.from('team_members').upsert(
      players.map((p) => ({ team_id: roster.team_id, athlete_id: p.athlete_id })),
      { onConflict: 'team_id,athlete_id', ignoreDuplicates: true }
    );
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?roster=${roster_id}`);
}

export async function removeRosterPlayer(formData: FormData) {
  const id = formData.get('id') as string;
  const roster_id = formData.get('roster_id') as string;

  const supabase = await createClient();
  const { error } = await supabase.from('roster_players').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?roster=${roster_id}&error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?roster=${roster_id}`);
}
