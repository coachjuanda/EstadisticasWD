import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReportPlayerRow, ReportStatDef, ReportTeamStats } from './types';

export type MatchBoxScoreData = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  tournamentName: string;
  status: string;
  scheduledAt: string;
  location: string | null;
  homeScore: number;
  awayScore: number;
  fieldPlayers: (ReportPlayerRow & { jerseyNumber: number | null; position: string | null })[];
  goalies: (ReportPlayerRow & { jerseyNumber: number | null; position: string | null })[];
  didNotPlay: { athleteId: string; label: string }[];
  teamStats: ReportTeamStats;
  statDefs: ReportStatDef[];
};

export type LoadResult<T> = { ok: true; data: T } | { ok: false; reason: 'not_found' | 'unauthorized' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMatchBoxScore(supabase: SupabaseClient<any>, matchId: string): Promise<LoadResult<MatchBoxScoreData>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'unauthorized' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, status, scheduled_at, location, away_team_name, home_team_id, tournament_id, teams(name), tournaments(name)'
    )
    .eq('id', matchId)
    .maybeSingle<{
      id: string;
      status: string;
      scheduled_at: string;
      location: string | null;
      away_team_name: string;
      home_team_id: string;
      tournament_id: string;
      teams: { name: string } | null;
      tournaments: { name: string } | null;
    }>();

  if (!match) return { ok: false, reason: 'not_found' };

  // Control de acceso explícito por rol: admin ve cualquier partido de su
  // club, coach solo si el partido es de uno de sus equipos, deportista solo
  // si él mismo está en la nómina de ese equipo+torneo.
  if (profile?.role === 'admin') {
    // ok
  } else if (profile?.role === 'coach') {
    const { data: ct } = await supabase
      .from('coach_teams')
      .select('team_id')
      .eq('coach_id', user.id)
      .eq('team_id', match.home_team_id)
      .maybeSingle();
    if (!ct) return { ok: false, reason: 'unauthorized' };
  } else if (profile?.role === 'deportista') {
    const { data: rp } = await supabase
      .from('roster_players')
      .select('id, rosters!inner(team_id, tournament_id)')
      .eq('athlete_id', user.id)
      .eq('rosters.team_id', match.home_team_id)
      .eq('rosters.tournament_id', match.tournament_id)
      .maybeSingle();
    if (!rp) return { ok: false, reason: 'unauthorized' };
  } else {
    return { ok: false, reason: 'unauthorized' };
  }

  const [{ data: matchPlayerStats }, { data: roster }, { data: tournamentStats }, { data: teamStatsRow }] =
    await Promise.all([
      supabase
        .from('match_player_stats')
        .select('athlete_id, stats, participated, athlete_profiles(full_name, position)')
        .eq('match_id', matchId)
        .returns<
          {
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
        .select('stats')
        .eq('match_id', matchId)
        .eq('team_id', match.home_team_id)
        .maybeSingle<{ stats: Record<string, number> }>(),
    ]);

  const jerseyByAthlete = new Map<string, number | null>();
  for (const rp of roster?.roster_players ?? []) {
    jerseyByAthlete.set(rp.athlete_id, rp.jersey_number);
  }

  const allRows = matchPlayerStats ?? [];

  const players: (ReportPlayerRow & { jerseyNumber: number | null; position: string | null })[] = allRows
    .filter((mps) => mps.participated)
    .map((mps) => ({
      athleteId: mps.athlete_id,
      jerseyNumber: jerseyByAthlete.get(mps.athlete_id) ?? null,
      position: mps.athlete_profiles?.position ?? null,
      label: `#${jerseyByAthlete.get(mps.athlete_id) ?? '—'} ${mps.athlete_profiles?.full_name ?? '—'}`,
      stats: mps.stats ?? {},
    }));
  players.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));

  const fieldPlayers = players.filter((p) => p.position !== 'portero');
  const goalies = players.filter((p) => p.position === 'portero');

  const didNotPlay = allRows
    .filter((mps) => !mps.participated)
    .map((mps) => ({
      athleteId: mps.athlete_id,
      label: `#${jerseyByAthlete.get(mps.athlete_id) ?? '—'} ${mps.athlete_profiles?.full_name ?? '—'}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const statDefs: ReportStatDef[] = (tournamentStats ?? [])
    .map((row) => row.stat_definitions)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => ({
      id: s.id,
      key: s.key,
      label: s.label,
      appliesTo: s.applies_to,
      scope: s.scope,
      sortOrder: s.sort_order,
    }));

  const teamStats: ReportTeamStats = teamStatsRow ? { stats: teamStatsRow.stats ?? {} } : null;

  const homeScore = players.reduce((sum, p) => sum + (p.stats.goals ?? 0), 0);
  const awayScore = players.reduce((sum, p) => sum + (p.stats.goals_received ?? 0), 0);

  return {
    ok: true,
    data: {
      matchId,
      homeTeamName: match.teams?.name ?? '—',
      awayTeamName: match.away_team_name,
      tournamentName: match.tournaments?.name ?? '—',
      status: match.status,
      scheduledAt: match.scheduled_at,
      location: match.location,
      homeScore,
      awayScore,
      fieldPlayers,
      goalies,
      didNotPlay,
      teamStats,
      statDefs,
    },
  };
}
