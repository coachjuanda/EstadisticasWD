import { createClient } from '@/lib/supabase/server';

type DivisionOption = { id: string; name: string };
type PersonOption = { id: string; full_name: string };

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

export default async function AdminTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{
    division_id?: string;
    date_from?: string;
    date_to?: string;
    athlete_id?: string;
    coach_id?: string;
  }>;
}) {
  const { division_id, date_from, date_to, athlete_id, coach_id } = await searchParams;
  const supabase = await createClient();

  const [{ data: divisions }, { data: athletes }] = await Promise.all([
    supabase.from('divisions').select('id, name').order('name').returns<DivisionOption[]>(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'deportista')
      .order('full_name')
      .returns<PersonOption[]>(),
  ]);

  let sessionsQuery = supabase
    .from('training_sessions')
    .select('id, scheduled_at, training_session_divisions(division_id, divisions(name))');

  if (date_from) sessionsQuery = sessionsQuery.gte('scheduled_at', `${date_from}T00:00:00`);
  if (date_to) sessionsQuery = sessionsQuery.lte('scheduled_at', `${date_to}T23:59:59`);

  const { data: sessionsData } = await sessionsQuery.returns<SessionRow[]>();

  let sessions = sessionsData ?? [];
  if (division_id) {
    sessions = sessions.filter((s) => s.training_session_divisions.some((d) => d.division_id === division_id));
  }
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const sessionIds = sessions.map((s) => s.id);

  let attendanceRows: AttendanceRow[] = [];
  if (sessionIds.length > 0) {
    let attendanceQuery = supabase
      .from('training_attendance')
      .select('id, athlete_id, training_session_id, present, athlete_profiles(full_name)')
      .in('training_session_id', sessionIds);

    if (athlete_id) attendanceQuery = attendanceQuery.eq('athlete_id', athlete_id);

    const { data } = await attendanceQuery.returns<AttendanceRow[]>();
    attendanceRows = data ?? [];
  }

  type AthleteAgg = { athleteId: string; fullName: string; total: number; present: number };
  const aggMap = new Map<string, AthleteAgg>();
  for (const row of attendanceRows) {
    if (!aggMap.has(row.athlete_id)) {
      aggMap.set(row.athlete_id, {
        athleteId: row.athlete_id,
        fullName: row.athlete_profiles?.full_name ?? '—',
        total: 0,
        present: 0,
      });
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

  // Conteo de presencia de entrenadores -- sin filtros de división/fecha
  // (a propósito, es un panel aparte e independiente del de deportistas) y
  // sin porcentaje: training_session_coaches no tiene concepto de
  // "convocado", así que no hay denominador contra el cual calcular uno.
  const { data: coachAttendanceRows } = await supabase
    .from('training_session_coaches')
    .select('coach_id, training_session_id, profiles(full_name), training_sessions(scheduled_at, training_session_divisions(divisions(name)))')
    .returns<CoachAttendanceRow[]>();

  type CoachAgg = { coachId: string; fullName: string; sessionsPresent: number };
  const coachAggMap = new Map<string, CoachAgg>();
  for (const row of coachAttendanceRows ?? []) {
    if (!coachAggMap.has(row.coach_id)) {
      coachAggMap.set(row.coach_id, {
        coachId: row.coach_id,
        fullName: row.profiles?.full_name ?? '—',
        sessionsPresent: 0,
      });
    }
    coachAggMap.get(row.coach_id)!.sessionsPresent += 1;
  }
  const coachSummary = [...coachAggMap.values()].sort((a, b) => b.sessionsPresent - a.sessionsPresent);

  // Detalle de sesiones de un entrenador puntual -- misma data ya traída
  // arriba, solo se filtra y se re-mapea a fecha + divisiones, sin necesitar
  // una segunda consulta.
  const coachDetail = (coachAttendanceRows ?? [])
    .filter((row) => row.coach_id === coach_id)
    .map((row) => ({
      id: row.training_session_id,
      scheduledAt: row.training_sessions?.scheduled_at ?? '',
      divisionNames: (row.training_sessions?.training_session_divisions ?? [])
        .map((d) => d.divisions?.name)
        .filter(Boolean)
        .join(', '),
    }))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  const hasFilters = Boolean(division_id || date_from || date_to || athlete_id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-neutral-900">Asistencia a entrenamientos</h1>

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-division">
            División
          </label>
          <select
            id="filter-division"
            name="division_id"
            defaultValue={division_id ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {(divisions ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-date-from">
            Desde
          </label>
          <input
            id="filter-date-from"
            type="date"
            name="date_from"
            defaultValue={date_from ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-date-to">
            Hasta
          </label>
          <input
            id="filter-date-to"
            type="date"
            name="date_to"
            defaultValue={date_to ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-athlete">
            Deportista
          </label>
          <select
            id="filter-athlete"
            name="athlete_id"
            defaultValue={athlete_id ?? ''}
            className="max-w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            {(athletes ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Filtrar
        </button>
        {hasFilters && (
          <a href="/dashboard/admin/training" className="text-sm text-neutral-500 hover:underline">
            Limpiar
          </a>
        )}
      </form>

      {athlete_id ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-neutral-700">
            {athletes?.find((a) => a.id === athlete_id)?.full_name ?? 'Deportista'} — {detail.length > 0 ? Math.round((detail.filter((d) => d.present).length / detail.length) * 100) : 0}% de asistencia
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {detail.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm"
              >
                <span className="text-neutral-700">
                  {new Date(d.scheduledAt).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                  {d.divisionNames && ` · ${d.divisionNames}`}
                </span>
                <span className={d.present ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                  {d.present ? 'Presente' : 'Ausente'}
                </span>
              </div>
            ))}
            {detail.length === 0 && (
              <p className="text-sm text-neutral-500">Sin convocatorias con ese filtro.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-3 py-2 font-medium">Deportista</th>
                <th className="px-3 py-2 text-right font-medium">Convocatorias</th>
                <th className="px-3 py-2 text-right font-medium">Presentes</th>
                <th className="px-3 py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((a) => (
                <tr key={a.athleteId} className="border-b border-neutral-100">
                  <td className="px-3 py-2">
                    <a
                      href={`/dashboard/admin/training?${new URLSearchParams({
                        ...(division_id ? { division_id } : {}),
                        ...(date_from ? { date_from } : {}),
                        ...(date_to ? { date_to } : {}),
                        athlete_id: a.athleteId,
                      }).toString()}`}
                      className="text-brand-blue hover:underline"
                    >
                      {a.fullName}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.present}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{a.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!athlete_id && summary.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">No hay convocatorias con ese filtro.</p>
      )}

      <h2 className="mt-10 text-lg font-semibold text-neutral-900">Asistencia de entrenadores</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Sesiones en las que cada entrenador estuvo presente (conteo total, sin comparar contra convocatorias).
      </p>

      {coach_id ? (
        <div className="mt-4">
          <a
            href="/dashboard/admin/training"
            className="text-sm text-neutral-500 hover:underline"
          >
            ← Volver al resumen de entrenadores
          </a>
          <h3 className="mt-2 text-sm font-semibold text-neutral-700">
            {coachSummary.find((c) => c.coachId === coach_id)?.fullName ?? 'Entrenador'} — {coachDetail.length} sesión{coachDetail.length === 1 ? '' : 'es'}
          </h3>
          <div className="mt-3 flex flex-col gap-2">
            {coachDetail.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm"
              >
                <span className="text-neutral-700">
                  {d.scheduledAt
                    ? new Date(d.scheduledAt).toLocaleDateString('es-CO', { dateStyle: 'long' })
                    : '—'}
                  {d.divisionNames && ` · ${d.divisionNames}`}
                </span>
              </div>
            ))}
            {coachDetail.length === 0 && (
              <p className="text-sm text-neutral-500">Este entrenador no tiene sesiones registradas.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[320px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-3 py-2 font-medium">Entrenador</th>
                <th className="px-3 py-2 text-right font-medium">Sesiones presente</th>
              </tr>
            </thead>
            <tbody>
              {coachSummary.map((c) => (
                <tr key={c.coachId} className="border-b border-neutral-100">
                  <td className="px-3 py-2">
                    <a
                      href={`/dashboard/admin/training?coach_id=${c.coachId}`}
                      className="text-brand-blue hover:underline"
                    >
                      {c.fullName}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{c.sessionsPresent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!coach_id && coachSummary.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">Aún no hay entrenadores marcados como presentes en ninguna sesión.</p>
      )}
    </div>
  );
}
