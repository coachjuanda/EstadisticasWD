import { createClient } from '@/lib/supabase/server';
import { createTemplate } from './actions';

type TemplateRow = {
  id: string;
  title: string;
  target: string;
  created_at: string;
  survey_questions: { id: string }[];
  survey_responses: { id: string }[];
};

const TARGET_LABELS: Record<string, string> = {
  deportista: 'Deportistas',
  padre: 'Padres',
};

export default async function AdminSurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from('survey_templates')
    .select('id, title, target, created_at, survey_questions(id), survey_responses(id)')
    .order('created_at', { ascending: false })
    .returns<TemplateRow[]>();

  const templateList = templates ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-neutral-900">Encuestas</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {templateList.map((t) => (
          <a
            key={t.id}
            href={`/dashboard/admin/surveys/${t.id}`}
            className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 hover:border-brand-blue"
          >
            <div>
              <p className="font-medium text-neutral-900">{t.title}</p>
              <p className="text-sm text-neutral-500">
                Dirigida a {TARGET_LABELS[t.target] ?? t.target} · {t.survey_questions.length} pregunta(s) ·{' '}
                {t.survey_responses.length} respuesta(s)
              </p>
            </div>
          </a>
        ))}
        {templateList.length === 0 && (
          <p className="text-sm text-neutral-500">No hay encuestas todavía.</p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">Crear nueva encuesta</h2>
      <form action={createTemplate} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="title">
            Título
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="Ej. Encuesta de seguimiento — temporada 2026"
            className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm sm:w-72"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="target">
            Dirigida a
          </label>
          <select
            id="target"
            name="target"
            required
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="deportista">Deportistas</option>
            <option value="padre">Padres</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Crear y agregar preguntas
        </button>
      </form>
    </div>
  );
}
