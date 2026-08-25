import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { addQuestion, deleteQuestion, deleteTemplate } from '../actions';

type QuestionRow = {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  sort_order: number;
};

const TYPE_LABELS: Record<string, string> = {
  escala: 'Escala (1-5)',
  opcion_multiple: 'Opción múltiple',
  texto_libre: 'Texto libre',
};

export default async function ManageSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { templateId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('survey_templates')
    .select('id, title, target')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) {
    redirect('/dashboard/admin/surveys');
  }

  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, question_text, question_type, options, sort_order')
    .eq('template_id', templateId)
    .order('sort_order')
    .returns<QuestionRow[]>();

  const questionList = questions ?? [];
  const nextSortOrder = questionList.length > 0 ? Math.max(...questionList.map((q) => q.sort_order)) + 1 : 1;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/admin/surveys" className="text-sm text-neutral-500 hover:underline">
        ← Volver a encuestas
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{template.title}</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {questionList.map((q, idx) => (
          <div
            key={q.id}
            className="flex items-start justify-between rounded-xl border border-neutral-200 p-3"
          >
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {idx + 1}. {q.question_text}
              </p>
              <p className="text-xs text-neutral-500">
                {TYPE_LABELS[q.question_type] ?? q.question_type}
                {q.options ? ` — ${q.options.join(', ')}` : ''}
              </p>
            </div>
            <form action={deleteQuestion}>
              <input type="hidden" name="id" value={q.id} />
              <input type="hidden" name="template_id" value={templateId} />
              <button type="submit" className="text-sm text-red-600 hover:underline">
                Eliminar
              </button>
            </form>
          </div>
        ))}
        {questionList.length === 0 && (
          <p className="text-sm text-neutral-500">Todavía no hay preguntas.</p>
        )}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-neutral-700">Agregar pregunta</h2>
      <form
        action={addQuestion}
        className="mt-3 flex flex-col gap-3 rounded-xl border border-neutral-200 p-4"
      >
        <input type="hidden" name="template_id" value={templateId} />
        <input type="hidden" name="sort_order" value={nextSortOrder} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="question_text">
            Pregunta
          </label>
          <input
            id="question_text"
            name="question_text"
            required
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="question_type">
            Tipo
          </label>
          <select
            id="question_type"
            name="question_type"
            required
            className="w-fit rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="escala">Escala (1-5)</option>
            <option value="opcion_multiple">Opción múltiple</option>
            <option value="texto_libre">Texto libre</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="options">
            Opciones (solo si es &quot;Opción múltiple&quot; — una por línea)
          </label>
          <textarea
            id="options"
            name="options"
            rows={3}
            placeholder={'Muy de acuerdo\nDe acuerdo\nEn desacuerdo'}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-fit rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Agregar pregunta
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <a
          href={`/dashboard/admin/surveys/${templateId}/responses`}
          className="text-sm text-brand-blue hover:underline"
        >
          Ver respuestas
        </a>
        <form action={deleteTemplate}>
          <input type="hidden" name="id" value={templateId} />
          <button type="submit" className="text-sm text-red-600 hover:underline">
            Eliminar encuesta completa
          </button>
        </form>
      </div>
    </div>
  );
}
