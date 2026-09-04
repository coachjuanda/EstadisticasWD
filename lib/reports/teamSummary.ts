import type { SupabaseClient } from '@supabase/supabase-js';
import { getActiveMembership } from '@/lib/auth/activeMembership';
import type { ReportPlayerRow, ReportStatDef, ReportTeamStats } from './types';
import type { LoadResult } from './matchBoxScore';

export type TeamSummaryData = {
  rosterId: string;
  teamName: string;
  divisionName: string | null;
  tournamentName: string;
  matchesConsidered: number;
  fieldPlayers: (ReportPlayerRow & { jerseyNumber: number | null; position: string | null })[];
  goalies: (ReportPlayerRow & { jerseyNumber: number | null; position: string | null })[];
  teamStats: ReportTeamStats;
  statDefs: ReportStatDef[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadTeamSummary(supabase: SupabaseClient<any>, rosterId: string): Promise<LoadResult<TeamSummaryData>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'unauthorized' };

  const membership = await getActiveMembership(supabase);

  const { data: roster } = await supabase
    .from('rosters')
    .select('id, team_id, tournament_id, teams(name, divisions(name)), tournaments(name)')
    .eq('id', rosterId)
    .maybeSingle<{
      id: string;
      team_id: string;
      tournament_id: string;
      teams: { name: string; divisions: { name: string } | null } | null;
      tournaments: { name: string } | null;
    }>();

  if (!roster) return { ok: false, reason: 'not_found' };

  // Control de acceso: admin ve cualquier nómina de su club, coach solo las
  // de sus equipos, deportista solo la suya propia (estar en la nómina).
  if (membership?.role === 'admin') {
    // ok
  } else if (membership?.role === 'coach') {
    const { data: ct } = await supabase
      .from('coach_teams')
      .select('team_id')
      .eq('coach_id', user.id)
      .eq('team_id', roster.team_id)
      .maybeSingle();
    if (!ct) return { ok: false, reason: 'unauthorized' };
  } else if (membership?.role === 'deportista') {
    const { data: rp } = await supabase
      .from('roster_players')
      .select('id')
      .eq('roster_id', rosterId)
      .eq('athlete_id', user.id)
      .maybeSingle();
    if (!rp) return { ok: false, reason: 'unauthorized' };
  } else {
    return { ok: false, reason: 'unauthorized' };
  }

  const [{ data: rosterPlayers }, { data: matches }, { data: tournamentStats }] = await Promise.all([
    supabase
      .from('roster_players')
      .select('athlete_id, jersey_number, athlete_profiles(full_name, position)')
      .eq('roster_id', rosterId)
      .returns<
        { athlete_id: string; jersey_number: number | null; athlete_profiles: { full_name: string; position: string | null } | null }[]
      >(),
    supabase
      .from('matches')
      .select('id')
      .eq('home_team_id', roster.team_id)
      .eq('tournament_id', roster.tournament_id)
      .neq('status', 'programado')
      .returns<{ id: string }[]>(),
    supabase
      .from('tournament_stat_config')
      .select('stat_definitions(id, key, label, applies_to, scope, sort_order)')
      .eq('tournament_id', roster.tournament_id)
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
  ]);

  const matchIds = (matches ?? []).map((m) => m.id);

  const [{ data: playerStatsRows }, { data: teamStatsRows }] =
    matchIds.length > 0
      ? await Promise.all([
          supabase
            .from('match_player_stats')
            .select('athlete_id, stats')
            .eq('team_id', roster.team_id)
            .eq('participated', true)
            .in('match_id', matchIds)
            .returns<{ athlete_id: string; stats: Record<string, number> }[]>(),
          supabase
            .from('match_team_stats')
            .select('stats')
            .eq('team_id', roster.team_id)
            .in('match_id', matchIds)
            .returns<{ stats: Record<string, number> }[]>(),
        ])
      : [{ data: [] as { athlete_id: string; stats: Record<string, number> }[] }, { data: [] as { stats: Record<string, number> }[] }];

  const aggregatedByAthlete = new Map<string, Record<string, number>>();
  for (const row of playerStatsRows ?? []) {
    const acc = aggregatedByAthlete.get(row.athlete_id) ?? {};
    for (const [key, value] of Object.entries(row.stats ?? {})) {
      acc[key] = (acc[key] ?? 0) + (value ?? 0);
    }
    aggregatedByAthlete.set(row.athlete_id, acc);
  }

  const aggregatedTeam: Record<string, number> = {};
  for (const row of teamStatsRows ?? []) {
    for (const [key, value] of Object.entries(row.stats ?? {})) {
      aggregatedTeam[key] = (aggregatedTeam[key] ?? 0) + (value ?? 0);
    }
  }

  const players: (ReportPlayerRow & { jerseyNumber: number | null; position: string | null })[] = (
    rosterPlayers ?? []
  ).map((rp) => ({
    athleteId: rp.athlete_id,
    jerseyNumber: rp.jersey_number,
    position: rp.athlete_profiles?.position ?? null,
    label: `#${rp.jersey_number ?? '—'} ${rp.athlete_profiles?.full_name ?? '—'}`,
    stats: aggregatedByAthlete.get(rp.athlete_id) ?? {},
  }));
  players.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));

  const fieldPlayers = players.filter((p) => p.position !== 'portero');
  const goalies = players.filter((p) => p.position === 'portero');

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

  const teamStats: ReportTeamStats = matchIds.length > 0 ? { stats: aggregatedTeam } : null;

  return {
    ok: true,
    data: {
      rosterId,
      teamName: roster.teams?.name ?? '—',
      divisionName: roster.teams?.divisions?.name ?? null,
      tournamentName: roster.tournaments?.name ?? '—',
      matchesConsidered: matchIds.length,
      fieldPlayers,
      goalies,
      teamStats,
      statDefs,
    },
  };
}
