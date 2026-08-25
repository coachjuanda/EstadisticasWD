import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoadResult } from './matchBoxScore';

const POSITION_LABELS: Record<string, string> = {
  jugador_de_campo: 'Jugador de campo',
  portero: 'Portero',
};

type StatDefRow = {
  id: string;
  key: string;
  label: string;
  applies_to: string | null;
  scope: 'jugador' | 'equipo';
  sort_order: number | null;
};

export type AthleteStatCard = { key: string; label: string; value: number | string };

export type AthleteProfileData = {
  athleteId: string;
  fullName: string;
  positionLabel: string;
  isGoalie: boolean;
  teams: string[];
  tournamentsPlayed: { id: string; name: string }[];
  selectedTournamentId: string | null;
  matchesInScope: number;
  statCards: AthleteStatCard[];
  teamMemberships: { rosterId: string; teamName: string; tournamentName: string }[];
};

export async function loadAthleteProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  athleteId: string,
  tournamentFilter?: string
): Promise<LoadResult<AthleteProfileData>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'unauthorized' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  const { data: athlete } = await supabase
    .from('athlete_profiles')
    .select('id, full_name, position')
    .eq('id', athleteId)
    .maybeSingle<{ id: string; full_name: string; position: string | null }>();

  if (!athlete) return { ok: false, reason: 'not_found' };

  if (profile?.role === 'admin') {
    // ok
  } else if (profile?.role === 'coach') {
    const { data: ct } = await supabase.from('coach_teams').select('team_id').eq('coach_id', user.id);
    const teamIds = (ct ?? []).map((t) => t.team_id);
    if (teamIds.length === 0) return { ok: false, reason: 'unauthorized' };
    const { data: rp } = await supabase
      .from('roster_players')
      .select('id, rosters!inner(team_id)')
      .eq('athlete_id', athleteId)
      .in('rosters.team_id', teamIds)
      .maybeSingle();
    if (!rp) return { ok: false, reason: 'unauthorized' };
  } else if (profile?.role === 'deportista') {
    if (athleteId !== user.id) return { ok: false, reason: 'unauthorized' };
  } else {
    return { ok: false, reason: 'unauthorized' };
  }

  const { data: rosterMemberships } = await supabase
    .from('roster_players')
    .select('roster_id, rosters(id, team_id, tournament_id, teams(name, divisions(name)), tournaments(name))')
    .eq('athlete_id', athleteId)
    .returns<
      {
        roster_id: string;
        rosters: {
          id: string;
          team_id: string;
          tournament_id: string;
          teams: { name: string; divisions: { name: string } | null } | null;
          tournaments: { name: string } | null;
        } | null;
      }[]
    >();

  const memberships = (rosterMemberships ?? []).map((m) => m.rosters).filter((r): r is NonNullable<typeof r> => r !== null);

  let statsQuery = supabase
    .from('match_player_stats')
    .select('stats, matches!inner(tournament_id, tournaments(name))')
    .eq('athlete_id', athleteId);

  if (tournamentFilter) {
    statsQuery = statsQuery.eq('matches.tournament_id', tournamentFilter);
  }

  const { data: statsRows } = await statsQuery.returns<
    { stats: Record<string, number>; matches: { tournament_id: string; tournaments: { name: string } | null } }[]
  >();

  const rows = statsRows ?? [];

  const { data: allStatsRows } = await supabase
    .from('match_player_stats')
    .select('matches!inner(tournament_id, tournaments(name))')
    .eq('athlete_id', athleteId)
    .returns<{ matches: { tournament_id: string; tournaments: { name: string } | null } }[]>();

  const tournamentsPlayed = new Map<string, string>();
  for (const r of allStatsRows ?? []) {
    tournamentsPlayed.set(r.matches.tournament_id, r.matches.tournaments?.name ?? '—');
  }

  const aggregated: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.stats ?? {})) {
      aggregated[key] = (aggregated[key] ?? 0) + (value ?? 0);
    }
  }

  const { data: statDefsData } = await supabase
    .from('stat_definitions')
    .select('id, key, label, applies_to, scope, sort_order')
    .eq('scope', 'jugador')
    .eq('applies_to', athlete.position ?? 'jugador_de_campo')
    .order('sort_order')
    .returns<StatDefRow[]>();

  const statDefs = statDefsData ?? [];
  const hasPlusMinus = statDefs.some((s) => s.key === 'plus') && statDefs.some((s) => s.key === 'minus');
  const isGoalie = athlete.position === 'portero';
  const shots = aggregated.shots_received ?? 0;
  const goalsAgainst = aggregated.goals_received ?? 0;
  const savePct = isGoalie && shots > 0 ? Math.round(((shots - goalsAgainst) / shots) * 100) : null;

  const statCards: AthleteStatCard[] = statDefs.map((s) => ({ key: s.key, label: s.label, value: aggregated[s.key] ?? 0 }));
  if (hasPlusMinus) {
    statCards.push({ key: 'plus_minus', label: '+/-', value: (aggregated.plus ?? 0) - (aggregated.minus ?? 0) });
  }
  if (isGoalie) {
    statCards.push({ key: 'save_pct', label: 'SV%', value: savePct !== null ? `${savePct}%` : '—' });
  }

  return {
    ok: true,
    data: {
      athleteId,
      fullName: athlete.full_name,
      positionLabel: POSITION_LABELS[athlete.position ?? ''] ?? '—',
      isGoalie,
      teams: memberships.map(
        (m) => `${m.teams?.name ?? '—'}${m.teams?.divisions?.name ? ` (${m.teams.divisions.name})` : ''}`
      ),
      tournamentsPlayed: [...tournamentsPlayed.entries()].map(([id, name]) => ({ id, name })),
      selectedTournamentId: tournamentFilter ?? null,
      matchesInScope: rows.length,
      statCards,
      teamMemberships: memberships.map((m) => ({
        rosterId: m.id,
        teamName: m.teams?.name ?? '—',
        tournamentName: m.tournaments?.name ?? '—',
      })),
    },
  };
}
