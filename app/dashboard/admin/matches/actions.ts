'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/matches';

function friendlyError(error: { code?: string; message: string }) {
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

function parseMatchForm(formData: FormData) {
  return {
    tournament_id: formData.get('tournament_id') as string,
    home_team_id: formData.get('home_team_id') as string,
    away_team_name: (formData.get('away_team_name') as string)?.trim(),
    scheduled_at: formData.get('scheduled_at') as string,
    location: (formData.get('location') as string)?.trim(),
    scorekeeper_id: (formData.get('scorekeeper_id') as string) || null,
  };
}

export async function createMatch(formData: FormData) {
  const { tournament_id, home_team_id, away_team_name, scheduled_at, location, scorekeeper_id } =
    parseMatchForm(formData);

  if (!tournament_id || !home_team_id || !away_team_name || !scheduled_at) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent('Torneo, equipo local, rival y fecha/hora son obligatorios.')}`
    );
  }

  const supabase = await createClient();
  const club_id = await getClubId(supabase);

  const { error } = await supabase.from('matches').insert({
    club_id,
    tournament_id,
    home_team_id,
    away_team_name,
    scheduled_at,
    location: location || null,
    scorekeeper_id,
    status: 'programado',
  });

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateMatch(formData: FormData) {
  const id = formData.get('id') as string;
  const { tournament_id, home_team_id, away_team_name, scheduled_at, location, scorekeeper_id } =
    parseMatchForm(formData);

  if (!id || !tournament_id || !home_team_id || !away_team_name || !scheduled_at) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Datos incompletos.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('matches')
    .update({
      tournament_id,
      home_team_id,
      away_team_name,
      scheduled_at,
      location: location || null,
      scorekeeper_id,
    })
    .eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

// Borrado forzado, exclusivo de admin: para partidos de PRUEBA que ya están
// en_vivo/finalizado y que deleteMatch bloquea a propósito. El admin tiene
// que escribir exactamente el nombre del rival -- esa comparación se hace
// en el servidor, no solo deshabilitando un botón en el cliente, porque un
// POST directo podría saltarse cualquier validación que viviera solo en el
// navegador. match_player_stats, match_team_stats y stat_audit_log tienen
// ON DELETE CASCADE hacia matches, así que un solo DELETE se lleva todo.
export async function forceDeleteMatch(formData: FormData) {
  const id = formData.get('id') as string;
  const confirmation = (formData.get('confirmation') as string)?.trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard?error=unauthorized');

  const { data: match } = await supabase.from('matches').select('away_team_name').eq('id', id).single();

  if (!match) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Partido no encontrado.')}`);
  }

  if (confirmation !== match.away_team_name) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent(
        'El texto no coincide con el nombre del rival. No se borró nada.'
      )}`
    );
  }

  const { error } = await supabase.from('matches').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteMatch(formData: FormData) {
  const id = formData.get('id') as string;
  const supabase = await createClient();

  const { data: match } = await supabase.from('matches').select('status').eq('id', id).single();

  if (!match) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Partido no encontrado.')}`);
  }

  // match_player_stats.match_id tiene ON DELETE CASCADE hacia matches -- sin
  // este chequeo explícito, borrar un partido finalizado borraría sus
  // estadísticas en cascada sin ningún error de la base de datos. El bloqueo
  // vive acá, no en una constraint.
  if (match.status !== 'programado') {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent(
        'No se puede eliminar: el partido ya está en vivo o finalizado.'
      )}`
    );
  }

  const { count } = await supabase
    .from('match_player_stats')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', id);

  if (count && count > 0) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent('No se puede eliminar: ya tiene estadísticas registradas.')}`
    );
  }

  const { error } = await supabase.from('matches').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
