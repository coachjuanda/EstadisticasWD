import { createClient } from '@/lib/supabase/server';
import { getActiveMembership, getPeopleByRole } from '@/lib/auth/activeMembership';
import { computeDueStatus } from '@/lib/evaluations/dueStatus';
import { AdminEvaluationsTable, type EvaluationRow } from './AdminEvaluationsTable';
import { setEvaluationDeadline } from './actions';

type ReportRow = {
  id: string;
  report_date: string;
  athlete_id: string;
  coach_id: string;
  division_id: string;
  athlete_profiles: { full_name: string } | null;
  people: { full_name: string } | null;
  divisions: { name: string } | null;
};
type DivisionOption = { id: string; name: string };

export default async function AdminEvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete_id?: string; coach_id?: string; division_id?: string; error?: string }>;
}) {
  const { athlete_id, coach_id, division_id, error } = await searchParams;
  const supabase = await createClient();

  const membership = await getActiveMembership(supabase);
  const { data: club } = await supabase
    .from('clubs')
    .select('evaluation_deadline')
    .eq('id', membership?.clubId as string)
    .maybeSingle();
  const evaluationDeadline = club?.evaluation_deadline ?? null;

  let reportsQuery = supabase
    .from('evaluation_reports')
    .select(
      'id, report_date, athlete_id, coach_id, division_id, athlete_profiles(full_name), people!coach_id(full_name), divisions(name)'
    )
    .order('report_date', { ascending: false });

  if (athlete_id) reportsQuery = reportsQuery.eq('athlete_id', athlete_id);
  if (coach_id) reportsQuery = reportsQuery.eq('coach_id', coach_id);
  if (division_id) reportsQuery = reportsQuery.eq('division_id', division_id);

  const [{ data: reports }, athletes, coaches, { data: divisions }, { data: allReports }] =
    await Promise.all([
      reportsQuery.returns<ReportRow[]>(),
      getPeopleByRole(supabase, 'deportista'),
      getPeopleByRole(supabase, 'coach'),
      supabase.from('divisions').select('id, name').order('name').returns<DivisionOption[]>(),
      // Sin filtrar -- el semáforo de una fila se calcula contra la última
      // evaluación REAL de ese deportista, no contra la fecha de esa fila en
      // particular (que puede no ser la más reciente si tiene varias).
      supabase
        .from('evaluation_reports')
        .select('athlete_id, report_date')
        .order('report_date', { ascending: false })
        .returns<{ athlete_id: string; report_date: string }[]>(),
    ]);

  const lastReportDateByAthlete = new Map<string, string>();
  for (const r of allReports ?? []) {
    if (!lastReportDateByAthlete.has(r.athlete_id)) lastReportDateByAthlete.set(r.athlete_id, r.report_date);
  }

  const rows: EvaluationRow[] = (reports ?? []).map((r) => ({
    id: r.id,
    athleteName: r.athlete_profiles?.full_name ?? '—',
    coachName: r.people?.full_name ?? '—',
    divisionName: r.divisions?.name ?? '—',
    reportDate: r.report_date,
    dueStatus: computeDueStatus(lastReportDateByAthlete.get(r.athlete_id) ?? null, evaluationDeadline),
  }));

  const hasFilters = Boolean(athlete_id || coach_id || division_id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-neutral-900">Evaluaciones</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Fecha límite de entrega de evaluaciones</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Si la fijas, el semáforo de vencimiento de todos los deportistas se calcula contra esta fecha en vez de
          la regla individual (última evaluación + 2 meses).
        </p>
        <form action={setEvaluationDeadline} className="mt-3 flex flex-wrap items-end gap-2">
          <input
            type="date"
            name="evaluation_deadline"
            defaultValue={evaluationDeadline ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
          >
            Guardar
          </button>
        </form>
        {evaluationDeadline && (
          <form action={setEvaluationDeadline} className="mt-2">
            <p className="text-xs text-neutral-500">
              Fijada: {new Date(`${evaluationDeadline}T00:00:00`).toLocaleDateString('es-CO', { dateStyle: 'long' })}
              {' · '}
              <button type="submit" className="text-red-600 hover:underline">
                Quitar fecha límite
              </button>
            </p>
          </form>
        )}
      </div>

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-athlete">
            Deportista
          </label>
          <select
            id="filter-athlete"
            name="athlete_id"
            defaultValue={athlete_id ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            {(athletes ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-coach">
            Coach
          </label>
          <select
            id="filter-coach"
            name="coach_id"
            defaultValue={coach_id ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            {(coaches ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-division">
            Categoría/Equipo
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
        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Filtrar
        </button>
        {hasFilters && (
          <a href="/dashboard/admin/evaluations" className="text-sm text-neutral-500 hover:underline">
            Limpiar
          </a>
        )}
      </form>

      <AdminEvaluationsTable reports={rows} />
    </div>
  );
}
