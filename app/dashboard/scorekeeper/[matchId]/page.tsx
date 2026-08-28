import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { startMatch } from './actions';
import { LiveMatchClient, type PlayerData, type StatDef } from './LiveMatchClient';

export default async function ScorekeeperMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { matchId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, status, scheduled_at, location, away_team_name, home_team_id, tournament_id, scorekeeper_id, teams(name), tournaments(name)'
    )
    .eq('id', matchId)
    .single<{
      id: string;
      status: string;
      scheduled_at: string;
      location: string | null;
      away_team_name: string;
      home_team_id: string;
      tournament_id: string;
      scorekeeper_id: string | null;
      teams: { name: string } | null;
      tournaments: { name: string } | null;
    }>();

  // "Ni siquiera otro scorekeeper": RLS permite leer cualquier partido del
  // club (política "matches: club members read"), así que el bloqueo de
  // "este partido no es tuyo" tiene que vivir acá, en la app.
  if (!match || match.scorekeeper_id !== user?.id) {
    redirect('/dashboard?error=unauthorized');
  }

  if (match.status === 'programado') {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-semibold text-neutral-900">
          {match.teams?.name ?? '—'} vs {match.away_team_name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {new Date(match.scheduled_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          {' · '}
          {match.location || 'sin cancha definida'} · {match.tournaments?.name ?? '—'}
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={startMatch} className="mt-6">
          <input type="hidden" name="match_id" value={matchId} />
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-blue px-4 py-3 text-lg font-semibold text-white hover:bg-brand-blue-hover"
          >
            Iniciar partido
          </button>
        </form>
      </div>
    );
  }

  if (match.status === 'finalizado') {
    const { data: stats } = await supabase
      .from('match_player_stats')
      .select('stats')
      .eq('match_id', matchId)
      .eq('participated', true);

    const homeScore = (stats ?? []).reduce((sum, s) => sum + ((s.stats as Record<string, number>).goals ?? 0), 0);
    const awayScore = (stats ?? []).reduce(
      (sum, s) => sum + ((s.stats as Record<string, number>).goals_received ?? 0),
      0
    );

    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">
          {match.teams?.name ?? '—'} {homeScore} - {awayScore} {match.away_team_name}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">Partido finalizado.</p>
        <Link
          href="/dashboard/scorekeeper"
          className="mt-4 inline-block rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Volver a mis partidos
        </Link>
      </div>
    );
  }

  // en_vivo: cargar jugadores + estadísticas de equipo + estadísticas
  // activas del torneo (de jugador y de equipo).
  const [{ data: matchPlayerStats }, { data: roster }, { data: tournamentStats }, { data: teamStatsRow }] =
    await Promise.all([
      supabase
        .from('match_player_stats')
        .select('id, athlete_id, stats, participated, athlete_profiles(full_name, position)')
        .eq('match_id', matchId)
        .returns<
          {
            id: string;
            athlete_id: string;
            stats: Record<string, number>;
            participated: boolean;
            athlete_profiles: { full_name: string; position: string | null } | null;
          }[]
        >(),
      supabase
        .from('rosters')
        .select('id, roster_players(athlete_id, jersey_number)')
        .eq('team_id', match.home_team_id)
        .eq('tournament_id', match.tournament_id)
        .maybeSingle<{ id: string; roster_players: { athlete_id: string; jersey_number: number | null }[] }>(),
      supabase
        .from('tournament_stat_config')
        .select('stat_definitions(id, key, label, applies_to, scope, sort_order)')
        .eq('tournament_id', match.tournament_id)
        .eq('enabled', true)
        .order('sort_order', { referencedTable: 'stat_definitions' })
        .returns<
          {
            stat_definitions: {
              id: string;
              key: string;
              label: string;
              applies_to: string | null;
              scope: 'jugador' | 'equipo';
              sort_order: number | null;
            } | null;
          }[]
        >(),
      supabase
        .from('match_team_stats')
        .select('id, stats')
        .eq('match_id', matchId)
        .eq('team_id', match.home_team_id)
        .maybeSingle<{ id: string; stats: Record<string, number> }>(),
    ]);

  const jerseyByAthlete = new Map<string, number | null>();
  for (const rp of roster?.roster_players ?? []) {
    jerseyByAthlete.set(rp.athlete_id, rp.jersey_number);
  }

  const players: PlayerData[] = (matchPlayerStats ?? []).map((mps) => ({
    matchPlayerStatId: mps.id,
    athleteId: mps.athlete_id,
    fullName: mps.athlete_profiles?.full_name ?? '—',
    jerseyNumber: jerseyByAthlete.get(mps.athlete_id) ?? null,
    position: mps.athlete_profiles?.position ?? null,
    participated: mps.participated,
    stats: mps.stats ?? {},
  }));
  players.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));

  const statDefs: StatDef[] = (tournamentStats ?? [])
    .map((row) => row.stat_definitions)
    .filter(
      (
        s
      ): s is {
        id: string;
        key: string;
        label: string;
        applies_to: string | null;
        scope: 'jugador' | 'equipo';
        sort_order: number | null;
      } => s !== null
    )
    .map((s) => ({
      id: s.id,
      key: s.key,
      label: s.label,
      appliesTo: s.applies_to,
      scope: s.scope,
      sortOrder: s.sort_order,
    }));

  const teamStats = teamStatsRow ? { matchTeamStatId: teamStatsRow.id, stats: teamStatsRow.stats ?? {} } : null;

  return (
    <LiveMatchClient
      matchId={matchId}
      homeTeamName={match.teams?.name ?? '—'}
      awayTeamName={match.away_team_name}
      initialPlayers={players}
      statDefs={statDefs}
      initialTeamStats={teamStats}
    />
  );
}
