import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAthleteTrainingAttendance, loadCoachTrainingAttendance } from '@/lib/reports/trainingAttendance';

type DivisionOption = { id: string; name: string };
type PersonOption = { id: string; full_name: string };

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildQuery(parts: {
  divisionIds?: string[];
  date_from?: string;
  date_to?: string;
  athlete_id?: string;
  coach_id?: string;
  sport?: string;
}) {
  const qs = new URLSearchParams();
  for (const d of parts.divisionIds ?? []) qs.append('division_id', d);
  if (parts.date_from) qs.set('date_from', parts.date_from);
  if (parts.date_to) qs.set('date_to', parts.date_to);
  if (parts.athlete_id) qs.set('athlete_id', parts.athlete_id);
  if (parts.coach_id) qs.set('coach_id', parts.coach_id);
  if (parts.sport) qs.set('sport', parts.sport);
  return qs.toString();
}

export default async function AdminTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{
    division_id?: string | string[];
    date_from?: string;
    date_to?: string;
    athlete_id?: string;
    coach_id?: string;
    sport?: string;
  }>;
}) {
  const { division_id, date_from, date_to, athlete_id, coach_id, sport } = await searchParams;
  const divisionIds = toArray(division_id);
  const supabase = await createClient();

  const [{ data: divisions }, { data: athletes }, athleteResult, coachResult] = await Promise.all([
    supabase.from('divisions').select('id, name').order('name').returns<DivisionOption[]>(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'deportista')
      .order('full_name')
      .returns<PersonOption[]>(),
    loadAthleteTrainingAttendance(supabase, { divisionIds, dateFrom: date_from, dateTo: date_to, athleteId: athlete_id, sport }),
    loadCoachTrainingAttendance(supabase, { dateFrom: date_from, dateTo: date_to, coachId: coach_id, sport }),
  ]);

  if (!athleteResult.ok || !coachResult.ok) redirect('/dashboard?error=unauthorized');

  const { summary, detail } = athleteResult.data;
  const { summary: coachSummary, detail: coachDetail } = coachResult.data;

  const hasFilters = Boolean(divisionIds.length > 0 || date_from || date_to || athlete_id);

  const athletesExportQuery = buildQuery({ divisionIds, date_from, date_to, athlete_id, sport });
  const coachesExportQuery = buildQuery({ date_from, date_to, coach_id, sport });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-neutral-900">Asistencia a entrenamientos</h1>

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">División</span>
          <div className="flex max-w-xs flex-wrap gap-1.5">
            {(divisions ?? []).map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
              >
                <input
                  type="checkbox"
                  name="division_id"
                  value={d.id}
                  defaultChecked={divisionIds.includes(d.id)}
                  className="h-3.5 w-3.5"
                />
                {d.name}
              </label>
            ))}
            {(divisions ?? []).length === 0 && <span className="text-xs text-neutral-400">Sin divisiones</span>}
          </div>
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
      <p className="mt-2 text-xs text-neutral-400">
        El rango de fechas (Desde/Hasta) aplica tanto a Deportistas como a Entrenadores. La división solo filtra la tabla
        de deportistas.
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">Deportistas</h2>
        <div className="flex shrink-0 gap-2">
          <a
            href={`/api/reports/training-attendance/athletes/pdf${athletesExportQuery ? `?${athletesExportQuery}` : ''}`}
            className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            PDF
          </a>
          <a
            href={`/api/reports/training-attendance/athletes/excel${athletesExportQuery ? `?${athletesExportQuery}` : ''}`}
            className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Excel
          </a>
        </div>
      </div>

      {athlete_id ? (
        <div className="mt-3">
          <a href={`/dashboard/admin/training?${buildQuery({ divisionIds, date_from, date_to })}`} className="text-sm text-neutral-500 hover:underline">
            ← Volver al resumen de deportistas
          </a>
          <h3 className="mt-2 text-sm font-semibold text-neutral-700">
            {athleteResult.data.meta.athleteName ?? athletes?.find((a) => a.id === athlete_id)?.full_name ?? 'Deportista'}
            {athleteResult.data.meta.sportLabel ? ` (${athleteResult.data.meta.sportLabel})` : ''} —{' '}
            {detail.length > 0 ? Math.round((detail.filter((d) => d.present).length / detail.length) * 100) : 0}% de asistencia
          </h3>
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
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-3 py-2 font-medium">Deportista</th>
                <th className="px-3 py-2 font-medium">Deporte</th>
                <th className="px-3 py-2 text-right font-medium">Convocatorias</th>
                <th className="px-3 py-2 text-right font-medium">Presentes</th>
                <th className="px-3 py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((a) => (
                <tr key={`${a.athleteId}::${a.sport ?? 'none'}`} className="border-b border-neutral-100">
                  <td className="px-3 py-2">
                    <a
                      href={`/dashboard/admin/training?${buildQuery({ divisionIds, date_from, date_to, athlete_id: a.athleteId, sport: a.sport ?? undefined })}`}
                      className="text-brand-blue hover:underline"
                    >
                      {a.fullName}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{a.sportLabel}</td>
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

      <div className="mt-10 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">Asistencia de entrenadores</h2>
        <div className="flex shrink-0 gap-2">
          <a
            href={`/api/reports/training-attendance/coaches/pdf${coachesExportQuery ? `?${coachesExportQuery}` : ''}`}
            className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            PDF
          </a>
          <a
            href={`/api/reports/training-attendance/coaches/excel${coachesExportQuery ? `?${coachesExportQuery}` : ''}`}
            className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Excel
          </a>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Sesiones en las que cada entrenador estuvo presente (conteo total, sin comparar contra convocatorias).
      </p>

      {coach_id ? (
        <div className="mt-4">
          <a
            href={`/dashboard/admin/training?${buildQuery({ date_from, date_to })}`}
            className="text-sm text-neutral-500 hover:underline"
          >
            ← Volver al resumen de entrenadores
          </a>
          <h3 className="mt-2 text-sm font-semibold text-neutral-700">
            {coachResult.data.meta.coachName ?? coachSummary.find((c) => c.coachId === coach_id)?.fullName ?? 'Entrenador'}
            {coachResult.data.meta.sportLabel ? ` (${coachResult.data.meta.sportLabel})` : ''} — {coachDetail.length} sesión
            {coachDetail.length === 1 ? '' : 'es'}
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
              <p className="text-sm text-neutral-500">Este entrenador no tiene sesiones registradas con ese filtro.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[320px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-3 py-2 font-medium">Entrenador</th>
                <th className="px-3 py-2 font-medium">Deporte</th>
                <th className="px-3 py-2 text-right font-medium">Sesiones presente</th>
              </tr>
            </thead>
            <tbody>
              {coachSummary.map((c) => (
                <tr key={`${c.coachId}::${c.sport ?? 'none'}`} className="border-b border-neutral-100">
                  <td className="px-3 py-2">
                    <a
                      href={`/dashboard/admin/training?${buildQuery({ date_from, date_to, coach_id: c.coachId, sport: c.sport ?? undefined })}`}
                      className="text-brand-blue hover:underline"
                    >
                      {c.fullName}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{c.sportLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{c.sessionsPresent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!coach_id && coachSummary.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">Aún no hay entrenadores marcados como presentes con ese filtro.</p>
      )}
    </div>
  );
}
