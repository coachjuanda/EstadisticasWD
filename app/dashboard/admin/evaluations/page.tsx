import { createClient } from '@/lib/supabase/server';

type ReportRow = {
  id: string;
  report_date: string;
  athlete_id: string;
  coach_id: string;
  athlete_profiles: { full_name: string } | null;
  profiles: { full_name: string } | null;
  divisions: { name: string } | null;
};
type PersonOption = { id: string; full_name: string };

export default async function AdminEvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete_id?: string; coach_id?: string }>;
}) {
  const { athlete_id, coach_id } = await searchParams;
  const supabase = await createClient();

  let reportsQuery = supabase
    .from('evaluation_reports')
    .select('id, report_date, athlete_id, coach_id, athlete_profiles(full_name), profiles!coach_id(full_name), divisions(name)')
    .order('report_date', { ascending: false });

  if (athlete_id) reportsQuery = reportsQuery.eq('athlete_id', athlete_id);
  if (coach_id) reportsQuery = reportsQuery.eq('coach_id', coach_id);

  const [{ data: reports }, { data: athletes }, { data: coaches }] = await Promise.all([
    reportsQuery.returns<ReportRow[]>(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'deportista')
      .order('full_name')
      .returns<PersonOption[]>(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'coach')
      .order('full_name')
      .returns<PersonOption[]>(),
  ]);

  const reportList = reports ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-neutral-900">Evaluaciones</h1>

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
        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Filtrar
        </button>
        {(athlete_id || coach_id) && (
          <a href="/dashboard/admin/evaluations" className="text-sm text-neutral-500 hover:underline">
            Limpiar
          </a>
        )}
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {reportList.map((r) => (
          <a
            key={r.id}
            href={`/dashboard/evaluations/${r.id}`}
            className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 hover:border-brand-blue"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {r.athlete_profiles?.full_name ?? '—'}
              </p>
              <p className="text-sm text-neutral-500">
                {new Date(r.report_date).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                {' · '}
                {r.divisions?.name ?? '—'} · Evaluado por {r.profiles?.full_name ?? '—'}
              </p>
            </div>
          </a>
        ))}
        {reportList.length === 0 && (
          <p className="text-sm text-neutral-500">No hay evaluaciones con ese filtro.</p>
        )}
      </div>
    </div>
  );
}
