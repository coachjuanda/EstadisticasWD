import { createClient } from '@/lib/supabase/server';

type TemplateRow = { id: string; title: string; target: string };

const TARGET_LABELS: Record<string, string> = {
  deportista: 'Deportistas',
  padre: 'Padres',
};

export default async function AthleteSurveysPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: templates }, { data: responses }] = await Promise.all([
    supabase.from('survey_templates').select('id, title, target').returns<TemplateRow[]>(),
    supabase.from('survey_responses').select('template_id').eq('user_id', user!.id),
  ]);

  const answeredIds = new Set((responses ?? []).map((r) => r.template_id));
  const templateList = templates ?? [];

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Encuestas</h1>

      <div className="mt-6 flex flex-col gap-3">
        {templateList.map((t) => {
          const answered = answeredIds.has(t.id);
          return (
            <a
              key={t.id}
              href={`/dashboard/athlete/surveys/${t.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 hover:border-brand-blue"
            >
              <div>
                <p className="font-medium text-neutral-900">{t.title}</p>
                <p className="text-sm text-neutral-500">
                  Dirigida a {TARGET_LABELS[t.target] ?? t.target}
                </p>
              </div>
              <span
                className={
                  answered
                    ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                    : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700'
                }
              >
                {answered ? 'Respondida' : 'Pendiente'}
              </span>
            </a>
          );
        })}
        {templateList.length === 0 && (
          <p className="text-sm text-neutral-500">No hay encuestas disponibles.</p>
        )}
      </div>
    </div>
  );
}
