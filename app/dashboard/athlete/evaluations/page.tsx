import { createClient } from '@/lib/supabase/server';

type ReportRow = {
  id: string;
  report_date: string;
  coach_id: string;
  divisions: { name: string } | null;
};
type CoachName = { id: string; full_name: string };

export default async function AthleteEvaluationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reports } = await supabase
    .from('evaluation_reports')
    .select('id, report_date, coach_id, divisions(name)')
    .eq('athlete_id', user!.id)
    .order('report_date', { ascending: false })
    .returns<ReportRow[]>();

  const reportList = reports ?? [];

  // profiles no se puede leer completo salvo que seas tú mismo o admin --
  // coach_names es la vista reducida (solo id + nombre) para mostrar quién
  // hizo cada evaluación.
  const coachIds = [...new Set(reportList.map((r) => r.coach_id))];
  const { data: coaches } =
    coachIds.length > 0
      ? await supabase.from('coach_names').select('id, full_name').in('id', coachIds).returns<CoachName[]>()
      : { data: [] as CoachName[] };
  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.full_name]));

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Mis evaluaciones</h1>

      <div className="mt-6 flex flex-col gap-3">
        {reportList.map((r) => (
          <a
            key={r.id}
            href={`/dashboard/evaluations/${r.id}`}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 hover:border-brand-blue"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {new Date(r.report_date).toLocaleDateString('es-CO', { dateStyle: 'long' })}
              </p>
              <p className="text-sm text-neutral-500">
                {r.divisions?.name ?? '—'} · Evaluado por {coachNameById.get(r.coach_id) ?? '—'}
              </p>
            </div>
          </a>
        ))}
        {reportList.length === 0 && (
          <p className="text-sm text-neutral-500">
            Todavía no tienes evaluaciones registradas.
          </p>
        )}
      </div>
    </div>
  );
}
