import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoadResult } from './matchBoxScore';

// Loader compartido por la página /dashboard/admin/training y sus 4 rutas de
// exportación (pdf/excel x deportistas/entrenadores) -- así el archivo
// descargado siempre refleja EXACTAMENTE los mismos filtros/datos que la
// pantalla, sin duplicar la lógica de consulta en cada endpoint.

type SessionRow = {
  id: string;
  scheduled_at: string;
  training_session_divisions: { division_id: string; divisions: { name: string } | null }[];
};

type AttendanceRow = {
  id: string;
  athlete_id: string;
  training_session_id: string;
  present: boolean;
  athlete_profiles: { full_name: string } | null;
};

type CoachAttendanceRow = {
  coach_id: string;
  training_session_id: string;
  profiles: { full_name: string } | null;
  training_sessions: {
    scheduled_at: string;
    training_session_divisions: { divisions: { name: string } | null }[];
  } | null;
};

async function requireAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<LoadResult<true>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'unauthorized' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { ok: false, reason: 'unauthorized' };

  return { ok: true, data: true };
}

export type AthleteAttendanceSummaryRow = { athleteId: string; fullName: string; total: number; present: number; pct: number };
export type AthleteAttendanceDetailRow = { id: string; scheduledAt: string; divisionNames: string; present: boolean };

export type AthleteTrainingAttendanceData = {
  summary: AthleteAttendanceSummaryRow[];
  detail: AthleteAttendanceDetailRow[]; // solo se llena cuando se filtra por un deportista puntual
  meta: { dateFrom?: string; dateTo?: string; divisionNames: string[]; athleteName?: string };
};

export async function loadAthleteTrainingAttendance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  filters: { divisionIds: string[]; dateFrom?: string; dateTo?: string; athleteId?: string }
): Promise<LoadResult<AthleteTrainingAttendanceData>> {
  const adminCheck = await requireAdmin(supabase);
  if (!adminCheck.ok) return adminCheck;

  const { divisionIds, dateFrom, dateTo, athleteId } = filters;

  let sessionsQuery = supabase
    .from('training_sessions')
    .select('id, scheduled_at, training_session_divisions(division_id, divisions(name))');
  if (dateFrom) sessionsQuery = sessionsQuery.gte('scheduled_at', `${dateFrom}T00:00:00`);
  if (dateTo) sessionsQuery = sessionsQuery.lte('scheduled_at', `${dateTo}T23:59:59`);

  const { data: sessionsData } = await sessionsQuery.returns<SessionRow[]>();

  let sessions = sessionsData ?? [];
  if (divisionIds.length > 0) {
    sessions = sessions.filter((s) => s.training_session_divisions.some((d) => divisionIds.includes(d.division_id)));
  }
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const sessionIds = sessions.map((s) => s.id);

  let attendanceRows: AttendanceRow[] = [];
  if (sessionIds.length > 0) {
    let attendanceQuery = supabase
      .from('training_attendance')
      .select('id, athlete_id, training_session_id, present, athlete_profiles(full_name)')
      .in('training_session_id', sessionIds);
    if (athleteId) attendanceQuery = attendanceQuery.eq('athlete_id', athleteId);

    const { data } = await attendanceQuery.returns<AttendanceRow[]>();
    attendanceRows = data ?? [];
  }

  const aggMap = new Map<string, AthleteAttendanceSummaryRow>();
  for (const row of attendanceRows) {
    if (!aggMap.has(row.athlete_id)) {
      aggMap.set(row.athlete_id, { athleteId: row.athlete_id, fullName: row.athlete_profiles?.full_name ?? '—', total: 0, present: 0, pct: 0 });
    }
    const agg = aggMap.get(row.athlete_id)!;
    agg.total += 1;
    if (row.present) agg.present += 1;
  }
  const summary = [...aggMap.values()]
    .map((a) => ({ ...a, pct: a.total > 0 ? Math.round((a.present / a.total) * 100) : 0 }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const detail = attendanceRows
    .map((row) => {
      const session = sessionById.get(row.training_session_id);
      return {
        id: row.id,
        scheduledAt: session?.scheduled_at ?? '',
        divisionNames: (session?.training_session_divisions ?? [])
          .map((d) => d.divisions?.name)
          .filter(Boolean)
          .join(', '),
        present: row.present,
      };
    })
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  const divisionNames = [...new Set(sessions.flatMap((s) => s.training_session_divisions.map((d) => d.divisions?.name).filter(Boolean)))] as string[];
  const athleteName = athleteId ? summary.find((a) => a.athleteId === athleteId)?.fullName ?? attendanceRows[0]?.athlete_profiles?.full_name : undefined;

  return {
    ok: true,
    data: { summary, detail: athleteId ? detail : [], meta: { dateFrom, dateTo, divisionNames, athleteName } },
  };
}

export type CoachAttendanceSummaryRow = { coachId: string; fullName: string; sessionsPresent: number };
export type CoachAttendanceDetailRow = { id: string; scheduledAt: string; divisionNames: string };

export type CoachTrainingAttendanceData = {
  summary: CoachAttendanceSummaryRow[];
  detail: CoachAttendanceDetailRow[]; // solo se llena cuando se filtra por un entrenador puntual
  meta: { dateFrom?: string; dateTo?: string; coachName?: string };
};

export async function loadCoachTrainingAttendance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  filters: { dateFrom?: string; dateTo?: string; coachId?: string }
): Promise<LoadResult<CoachTrainingAttendanceData>> {
  const adminCheck = await requireAdmin(supabase);
  if (!adminCheck.ok) return adminCheck;

  const { dateFrom, dateTo, coachId } = filters;

  // Sin filtro de división a propósito -- un entrenador no pertenece a una
  // división particular en una sesión (puede supervisar varias a la vez),
  // así que el panel de entrenadores solo respeta el rango de fechas
  // (compartido con el panel de deportistas), nunca la división elegida ahí.
  let coachQuery = supabase
    .from('training_session_coaches')
    .select(
      'coach_id, training_session_id, profiles(full_name), training_sessions!inner(scheduled_at, training_session_divisions(divisions(name)))'
    );
  if (dateFrom) coachQuery = coachQuery.gte('training_sessions.scheduled_at', `${dateFrom}T00:00:00`);
  if (dateTo) coachQuery = coachQuery.lte('training_sessions.scheduled_at', `${dateTo}T23:59:59`);

  const { data: coachAttendanceRows } = await coachQuery.returns<CoachAttendanceRow[]>();
  const rows = coachAttendanceRows ?? [];

  const aggMap = new Map<string, CoachAttendanceSummaryRow>();
  for (const row of rows) {
    if (!aggMap.has(row.coach_id)) {
      aggMap.set(row.coach_id, { coachId: row.coach_id, fullName: row.profiles?.full_name ?? '—', sessionsPresent: 0 });
    }
    aggMap.get(row.coach_id)!.sessionsPresent += 1;
  }
  const summary = [...aggMap.values()].sort((a, b) => b.sessionsPresent - a.sessionsPresent);

  const detail = rows
    .filter((row) => row.coach_id === coachId)
    .map((row) => ({
      id: row.training_session_id,
      scheduledAt: row.training_sessions?.scheduled_at ?? '',
      divisionNames: (row.training_sessions?.training_session_divisions ?? [])
        .map((d) => d.divisions?.name)
        .filter(Boolean)
        .join(', '),
    }))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  const coachName = coachId ? summary.find((c) => c.coachId === coachId)?.fullName ?? rows.find((r) => r.coach_id === coachId)?.profiles?.full_name : undefined;

  return {
    ok: true,
    data: { summary, detail: coachId ? detail : [], meta: { dateFrom, dateTo, coachName } },
  };
}
