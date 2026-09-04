import type { SupabaseClient } from '@supabase/supabase-js';
import { getActiveMembership } from '@/lib/auth/activeMembership';
import type { LoadResult } from '../reports/matchBoxScore';

export type TeamStatDef = {
  id: string;
  key: string;
  label: string;
  appliesTo: string | null;
  scope: 'jugador' | 'equipo';
  sortOrder: number | null;
};

export type TeamStatMatchPoint = {
  matchId: string;
  scheduledAt: string;
  awayTeamName: string;
  status: string;
  played: boolean;
  homeScore: number | null;
  awayScore: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  teamStats: Record<string, number> | null;
  playerStats: { athleteId: string; fullName: string; jerseyNumber: number | null; stats: Record<string, number> }[];
};

export type TeamSeasonPlayerRow = {
  athleteId: string;
  fullName: string;
  jerseyNumber: number | null;
  position: string | null;
  stats: Record<string, number>;
};

export type TeamStatsData = {
  teamId: string;
  teamName: string;
  divisionName: string | null;
  tournaments: { id: string; name: string }[];
  selectedTournamentId: string;
  selectedTournamentName: string;
  summary: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    ties: number;
    goalsFor: number;
    goalsAgainst: number;
    topStats: { key: string; label: string; value: number }[];
  };
  statDefs: TeamStatDef[];
  matches: TeamStatMatchPoint[];
  viewerRole: string;
  viewerAthleteId: string | null;
  rosterId: string | null;
  seasonFieldPlayers: TeamSeasonPlayerRow[];
  seasonGoalies: TeamSeasonPlayerRow[];
  seasonTeamStats: Record<string, number> | null;
};

export async function loadTeamStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  teamId: string,
  tournamentIdParam?: string
): Promise<LoadResult<TeamStatsData>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'unauthorized' };

  const membership = await getActiveMembership(supabase);

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, divisions(name)')
    .eq('id', teamId)
    .maybeSingle<{ id: string; name: string; divisions: { name: string } | null }>();

  if (!team) return { ok: false, reason: 'not_found' };

  // Control de acceso: admin ve cualquier equipo de su club, coach solo los
  // suyos (coach_teams), deportista solo el equipo de su propia nómina.
  if (membership?.role === 'admin') {
    // ok
  } else if (membership?.role === 'coach') {
    const { data: ct } = await supabase
      .from('coach_teams')
      .select('team_id')
      .eq('coach_id', user.id)
      .eq('team_id', teamId)
      .maybeSingle();
    if (!ct) return { ok: false, reason: 'unauthorized' };
  } else if (membership?.role === 'deportista') {
    const { data: rp } = await supabase
      .from('roster_players')
      .select('id, rosters!inner(team_id)')
      .eq('athlete_id', user.id)
      .eq('rosters.team_id', teamId)
      .maybeSingle();
    if (!rp) return { ok: false, reason: 'unauthorized' };
  } else {
    return { ok: false, reason: 'unauthorized' };
  }

  // Torneos en los que este equipo tiene nómina -- son los únicos en los que
  // puede tener partidos.
  const { data: rosterRows } = await supabase
    .from('rosters')
    .select('tournament_id, tournaments(id, name, start_date)')
    .eq('team_id', teamId)
    .returns<{ tournament_id: string; tournaments: { id: string; name: string; start_date: string | null } | null }[]>();

  const tournaments = (rosterRows ?? [])
    .map((r) => r.tournaments)
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));

  if (tournaments.length === 0) {
    return {
      ok: true,
      data: {
        teamId,
        teamName: team.name,
        divisionName: team.divisions?.name ?? null,
        tournaments: [],
        selectedTournamentId: '',
        selectedTournamentName: '',
        summary: { matchesPlayed: 0, wins: 0, losses: 0, ties: 0, goalsFor: 0, goalsAgainst: 0, topStats: [] },
        statDefs: [],
        matches: [],
        viewerRole: membership?.role ?? '',
        viewerAthleteId: membership?.role === 'deportista' ? user.id : null,
        rosterId: null,
        seasonFieldPlayers: [],
        seasonGoalies: [],
        seasonTeamStats: null,
      },
    };
  }

  const selectedTournament =
    tournaments.find((t) => t.id === tournamentIdParam) ?? tournaments[0];

  const [{ data: matches }, { data: tournamentStats }] = await Promise.all([
    supabase
      .from('matches')
      .select('id, scheduled_at, away_team_name, status')
      .eq('home_team_id', teamId)
      .eq('tournament_id', selectedTournament.id)
      .order('scheduled_at', { ascending: true })
      .returns<{ id: string; scheduled_at: string; away_team_name: string; status: string }[]>(),
    supabase
      .from('tournament_stat_config')
      .select('stat_definitions(id, key, label, applies_to, scope, sort_order)')
      .eq('tournament_id', selectedTournament.id)
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

  const statDefs: TeamStatDef[] = (tournamentStats ?? [])
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

  const matchList = matches ?? [];
  const playedMatches = matchList.filter((m) => m.status !== 'programado');
  const playedMatchIds = playedMatches.map((m) => m.id);

  // Nómina de este equipo+torneo (para números de camiseta) -- una sola
  // consulta, reutilizada para todos los partidos.
  const { data: roster } = await supabase
    .from('rosters')
    .select('id, roster_players(athlete_id, jersey_number)')
    .eq('team_id', teamId)
    .eq('tournament_id', selectedTournament.id)
    .maybeSingle<{ id: string; roster_players: { athlete_id: string; jersey_number: number | null }[] }>();

  const jerseyByAthlete = new Map<string, number | null>();
  for (const rp of roster?.roster_players ?? []) {
    jerseyByAthlete.set(rp.athlete_id, rp.jersey_number);
  }

  const [{ data: allPlayerStats }, { data: allTeamStats }] =
    playedMatchIds.length > 0
      ? await Promise.all([
          supabase
            .from('match_player_stats')
            .select('match_id, athlete_id, stats, athlete_profiles(full_name, position)')
            .eq('team_id', teamId)
            .eq('participated', true)
            .in('match_id', playedMatchIds)
            .returns<{ match_id: string; athlete_id: string; stats: Record<string, number>; athlete_profiles: { full_name: string; position: string | null } | null }[]>(),
          supabase
            .from('match_team_stats')
            .select('match_id, stats')
            .eq('team_id', teamId)
            .in('match_id', playedMatchIds)
            .returns<{ match_id: string; stats: Record<string, number> }[]>(),
        ])
      : [{ data: [] as { match_id: string; athlete_id: string; stats: Record<string, number>; athlete_profiles: { full_name: string; position: string | null } | null }[] }, { data: [] as { match_id: string; stats: Record<string, number> }[] }];

  const playerStatsByMatch = new Map<string, typeof allPlayerStats>();
  for (const row of allPlayerStats ?? []) {
    if (!playerStatsByMatch.has(row.match_id)) playerStatsByMatch.set(row.match_id, []);
    playerStatsByMatch.get(row.match_id)!.push(row);
  }
  const teamStatsByMatch = new Map<string, Record<string, number>>();
  for (const row of allTeamStats ?? []) {
    teamStatsByMatch.set(row.match_id, row.stats ?? {});
  }

  let goalsFor = 0;
  let goalsAgainst = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  const accumulated: Record<string, number> = {};
  const perPlayerAccumulated = new Map<string, Record<string, number>>();
  const playerMeta = new Map<string, { fullName: string; position: string | null }>();

  const teamStatDefKeys = statDefs.filter((s) => s.scope === 'equipo').map((s) => s.key);

  const points: TeamStatMatchPoint[] = matchList.map((m) => {
    const played = m.status !== 'programado';
    if (!played) {
      return {
        matchId: m.id,
        scheduledAt: m.scheduled_at,
        awayTeamName: m.away_team_name,
        status: m.status,
        played: false,
        homeScore: null,
        awayScore: null,
        result: null,
        teamStats: null,
        playerStats: [],
      };
    }

    const rows = playerStatsByMatch.get(m.id) ?? [];
    const teamRow = teamStatsByMatch.get(m.id) ?? {};

    const homeScore = rows.reduce((sum, r) => sum + (r.stats.goals ?? 0), 0);
    const awayScore = rows.reduce((sum, r) => sum + (r.stats.goals_received ?? 0), 0);
    goalsFor += homeScore;
    goalsAgainst += awayScore;

    let result: 'win' | 'loss' | 'tie' = 'tie';
    if (homeScore > awayScore) {
      result = 'win';
      wins++;
    } else if (homeScore < awayScore) {
      result = 'loss';
      losses++;
    } else {
      ties++;
    }

    const matchTeamStats: Record<string, number> = {};
    for (const row of rows) {
      if (!playerMeta.has(row.athlete_id)) {
        playerMeta.set(row.athlete_id, {
          fullName: row.athlete_profiles?.full_name ?? '—',
          position: row.athlete_profiles?.position ?? null,
        });
      }
      const playerAcc = perPlayerAccumulated.get(row.athlete_id) ?? {};
      for (const [key, value] of Object.entries(row.stats ?? {})) {
        matchTeamStats[key] = (matchTeamStats[key] ?? 0) + (value ?? 0);
        accumulated[key] = (accumulated[key] ?? 0) + (value ?? 0);
        playerAcc[key] = (playerAcc[key] ?? 0) + (value ?? 0);
      }
      perPlayerAccumulated.set(row.athlete_id, playerAcc);
    }
    for (const key of teamStatDefKeys) {
      const value = teamRow[key] ?? 0;
      matchTeamStats[key] = value;
      accumulated[key] = (accumulated[key] ?? 0) + value;
    }

    const playerStats = rows.map((r) => ({
      athleteId: r.athlete_id,
      fullName: r.athlete_profiles?.full_name ?? '—',
      jerseyNumber: jerseyByAthlete.get(r.athlete_id) ?? null,
      stats: r.stats ?? {},
    }));
    playerStats.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));

    return {
      matchId: m.id,
      scheduledAt: m.scheduled_at,
      awayTeamName: m.away_team_name,
      status: m.status,
      played: true,
      homeScore,
      awayScore,
      result,
      teamStats: matchTeamStats,
      playerStats,
    };
  });

  // "2-3 estadísticas más relevantes": las primeras del catálogo de jugador
  // de campo activo en el torneo (en su sort_order), sin importar el
  // deporte -- así no hay que hardcodear qué es "relevante" por deporte.
  const topStatDefs = statDefs
    .filter((s) => s.scope === 'jugador' && s.appliesTo === 'jugador_de_campo')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 3);
  const topStats = topStatDefs.map((s) => ({ key: s.key, label: s.label, value: accumulated[s.key] ?? 0 }));

  const seasonPlayers: TeamSeasonPlayerRow[] = [...perPlayerAccumulated.entries()].map(([athleteId, stats]) => {
    const meta = playerMeta.get(athleteId);
    return {
      athleteId,
      fullName: meta?.fullName ?? '—',
      jerseyNumber: jerseyByAthlete.get(athleteId) ?? null,
      position: meta?.position ?? null,
      stats,
    };
  });
  seasonPlayers.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));
  const seasonFieldPlayers = seasonPlayers.filter((p) => p.position !== 'portero');
  const seasonGoalies = seasonPlayers.filter((p) => p.position === 'portero');
  const seasonTeamStats = playedMatches.length > 0 ? accumulated : null;

  return {
    ok: true,
    data: {
      teamId,
      teamName: team.name,
      divisionName: team.divisions?.name ?? null,
      tournaments: tournaments.map((t) => ({ id: t.id, name: t.name })),
      selectedTournamentId: selectedTournament.id,
      selectedTournamentName: selectedTournament.name,
      summary: {
        matchesPlayed: playedMatches.length,
        wins,
        losses,
        ties,
        goalsFor,
        goalsAgainst,
        topStats,
      },
      statDefs,
      matches: points,
      viewerRole: membership?.role ?? '',
      viewerAthleteId: membership?.role === 'deportista' ? user.id : null,
      rosterId: roster?.id ?? null,
      seasonFieldPlayers,
      seasonGoalies,
      seasonTeamStats,
    },
  };
}
