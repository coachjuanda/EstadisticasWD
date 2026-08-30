import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoadResult } from './matchBoxScore';

const POSITION_LABELS: Record<string, string> = {
  jugador_de_campo: 'Jugador de campo',
  portero: 'Portero',
};

// Hockey en línea y hockey en hielo son deportes distintos -- sus stats nunca
// se suman entre sí. Único mapa de etiquetas para todo este archivo.
export const SPORT_LABELS: Record<string, string> = {
  hockey_linea: 'Hockey en línea',
  hockey_hielo: 'Hockey en hielo',
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

export type AthleteTrainingSession = {
  id: string;
  scheduledAt: string;
  divisionNames: string;
  present: boolean;
};

export type AthleteSportOption = { sport: string; label: string };

export type AthleteProfileData = {
  athleteId: string;
  fullName: string;
  positionLabel: string;
  isGoalie: boolean;
  teams: string[];
  availableSports: AthleteSportOption[];
  selectedSport: string | null;
  selectedSportLabel: string | null;
  tournamentsPlayed: { id: string; name: string }[];
  selectedTournamentId: string | null;
  matchesInScope: number;
  statCards: AthleteStatCard[];
  teamMemberships: { rosterId: string; teamId: string; tournamentId: string; teamName: string; tournamentName: string }[];
  attendancePct: number | null;
  attendanceTotal: number;
  attendancePresent: number;
  recentTrainingSessions: AthleteTrainingSession[];
  attendanceMonthOptions: string[];
  selectedAttendanceMonth: string | null;
  attendanceMonthPct: number | null;
  attendanceMonthTotal: number;
  attendanceMonthPresent: number;
};

export async function loadAthleteProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  athleteId: string,
  tournamentFilter?: string,
  attendanceMonthFilter?: string,
  sportFilter?: string
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
    .select(
      'roster_id, rosters(id, team_id, tournament_id, teams(name, sport, divisions(name)), tournaments(name, start_date))'
    )
    .eq('athlete_id', athleteId)
    .returns<
      {
        roster_id: string;
        rosters: {
          id: string;
          team_id: string;
          tournament_id: string;
          teams: { name: string; sport: string | null; divisions: { name: string } | null } | null;
          tournaments: { name: string; start_date: string | null } | null;
        } | null;
      }[]
    >();

  const memberships = (rosterMemberships ?? []).map((m) => m.rosters).filter((r): r is NonNullable<typeof r> => r !== null);

  // Deportes en los que el deportista tiene nómina, con la fecha de inicio
  // del torneo más reciente de cada uno -- decide qué deporte se muestra por
  // defecto (el de actividad más reciente) sin necesitar otra consulta.
  const sportRecency = new Map<string, string>();
  for (const m of memberships) {
    const sport = m.teams?.sport;
    if (!sport) continue;
    const start = m.tournaments?.start_date ?? '';
    const current = sportRecency.get(sport);
    if (current === undefined || start > current) sportRecency.set(sport, start);
  }

  const availableSports: AthleteSportOption[] = [...sportRecency.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((sport) => ({ sport, label: SPORT_LABELS[sport] ?? sport }));

  const defaultSport =
    [...sportRecency.entries()].sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0] ?? null;

  const selectedSport = sportFilter && sportRecency.has(sportFilter) ? sportFilter : defaultSport;

  // Una sola consulta trae las stats de TODOS los torneos y TODOS los
  // deportes del deportista; el deporte y el torneo se filtran acá en JS
  // (el volumen por deportista es chico -- no vale la pena una query por
  // combinación). team_id -> teams.sport es la fuente de verdad de en qué
  // deporte se jugó cada fila, igual que ya usan loadTeamStats/teamSummary.
  const { data: allRows } = await supabase
    .from('match_player_stats')
    .select('stats, team_id, teams(sport), matches!inner(tournament_id, tournaments(name))')
    .eq('athlete_id', athleteId)
    .eq('participated', true)
    .returns<
      {
        stats: Record<string, number>;
        team_id: string;
        teams: { sport: string | null } | null;
        matches: { tournament_id: string; tournaments: { name: string } | null };
      }[]
    >();

  const sportRows = selectedSport
    ? (allRows ?? []).filter((r) => r.teams?.sport === selectedSport)
    : [];

  const tournamentsPlayed = new Map<string, string>();
  for (const r of sportRows) {
    tournamentsPlayed.set(r.matches.tournament_id, r.matches.tournaments?.name ?? '—');
  }

  const scopedRows = tournamentFilter
    ? sportRows.filter((r) => r.matches.tournament_id === tournamentFilter)
    : sportRows;

  const aggregated: Record<string, number> = {};
  for (const row of scopedRows) {
    for (const [key, value] of Object.entries(row.stats ?? {})) {
      aggregated[key] = (aggregated[key] ?? 0) + (value ?? 0);
    }
  }

  // Catálogo: definiciones genéricas (sport = null, válidas en ambos
  // deportes) + las propias del deporte seleccionado (p. ej. disparos
  // bloqueados solo existe en hockey línea) -- así no aparecen tarjetas en
  // cero para conceptos que no existen en el deporte que se está viendo.
  let statDefs: StatDefRow[] = [];
  if (selectedSport) {
    const { data: statDefsData } = await supabase
      .from('stat_definitions')
      .select('id, key, label, applies_to, scope, sort_order')
      .eq('scope', 'jugador')
      .eq('applies_to', athlete.position ?? 'jugador_de_campo')
      .or(`sport.is.null,sport.eq.${selectedSport}`)
      .order('sort_order')
      .returns<StatDefRow[]>();
    statDefs = statDefsData ?? [];
  }

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

  // Asistencia a entrenamientos -- igual que las stats de partido, se acota
  // al deporte seleccionado (una sesión pertenece a un deporte a través de
  // la(s) división(es) que la componen). No se filtra por tournamentFilter
  // porque el entrenamiento no pertenece a un torneo.
  const { data: attendanceRows } = await supabase
    .from('training_attendance')
    .select('id, present, training_sessions(scheduled_at, training_session_divisions(divisions(name, sport)))')
    .eq('athlete_id', athleteId)
    .returns<
      {
        id: string;
        present: boolean;
        training_sessions: {
          scheduled_at: string;
          training_session_divisions: { divisions: { name: string; sport: string | null } | null }[];
        } | null;
      }[]
    >();

  const attendanceAll = (attendanceRows ?? []).filter((r) => r.training_sessions !== null);
  const attendance = selectedSport
    ? attendanceAll.filter((r) =>
        r.training_sessions!.training_session_divisions.some((d) => d.divisions?.sport === selectedSport)
      )
    : [];
  const attendanceTotal = attendance.length;
  const attendancePresent = attendance.filter((r) => r.present).length;
  const attendancePct = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null;

  // Meses con al menos una convocatoria, más recientes primero -- alimenta
  // el selector de mes sin necesitar una consulta aparte.
  const attendanceMonthOptions = [
    ...new Set(attendance.map((r) => r.training_sessions!.scheduled_at.slice(0, 7))),
  ].sort((a, b) => b.localeCompare(a));

  const attendanceInMonth = attendanceMonthFilter
    ? attendance.filter((r) => r.training_sessions!.scheduled_at.slice(0, 7) === attendanceMonthFilter)
    : null;
  const attendanceMonthTotal = attendanceInMonth?.length ?? 0;
  const attendanceMonthPresent = attendanceInMonth?.filter((r) => r.present).length ?? 0;
  const attendanceMonthPct =
    attendanceInMonth && attendanceInMonth.length > 0
      ? Math.round((attendanceMonthPresent / attendanceInMonth.length) * 100)
      : null;

  // Sin mes seleccionado: últimas 10 convocatorias en total. Con mes
  // seleccionado: todas las convocatorias de ese mes (normalmente pocas).
  const sessionsInScope = attendanceInMonth ?? attendance;
  const recentTrainingSessions: AthleteTrainingSession[] = sessionsInScope
    .map((r) => ({
      id: r.id,
      scheduledAt: r.training_sessions!.scheduled_at,
      divisionNames: r.training_sessions!.training_session_divisions
        .map((d) => d.divisions?.name)
        .filter(Boolean)
        .join(', '),
      present: r.present,
    }))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .slice(0, attendanceInMonth ? undefined : 10);

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
      availableSports,
      selectedSport,
      selectedSportLabel: selectedSport ? SPORT_LABELS[selectedSport] ?? selectedSport : null,
      tournamentsPlayed: [...tournamentsPlayed.entries()].map(([id, name]) => ({ id, name })),
      selectedTournamentId: tournamentFilter ?? null,
      matchesInScope: scopedRows.length,
      statCards,
      teamMemberships: memberships.map((m) => ({
        rosterId: m.id,
        teamId: m.team_id,
        tournamentId: m.tournament_id,
        teamName: m.teams?.name ?? '—',
        tournamentName: m.tournaments?.name ?? '—',
      })),
      attendancePct,
      attendanceTotal,
      attendancePresent,
      recentTrainingSessions,
      attendanceMonthOptions,
      selectedAttendanceMonth: attendanceMonthFilter ?? null,
      attendanceMonthPct,
      attendanceMonthTotal,
      attendanceMonthPresent,
    },
  };
}
