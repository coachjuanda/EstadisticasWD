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

export default async function AdminTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ division_id?: string; date_from?: string; date_to?: string; athlete_id?: string }>;
}) {
  const { division_id, date_from, date_to, athlete_id } = await searchParams;
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
    </div>
  );
}
