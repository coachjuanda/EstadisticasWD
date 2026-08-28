import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  addQuestion,
  deleteQuestion,
  deleteTemplate,
  moveQuestion,
  toggleQuestionActive,
  updateQuestion,
  updateTemplate,
} from '../actions';

type QuestionRow = {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  sort_order: number;
  scale_min: number;
  scale_max: number;
  is_required: boolean;
  is_active: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  escala: 'Escala',
  opcion_multiple: 'Opción múltiple',
  texto_libre: 'Texto libre',
};

const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: 'deportista', label: 'Deportistas' },
  { value: 'padre', label: 'Padres' },
];

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
    .select('id, title, target, description')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) {
    redirect('/dashboard/admin/surveys');
  }

  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, question_text, question_type, options, sort_order, scale_min, scale_max, is_required, is_active')
    .eq('template_id', templateId)
    .order('sort_order')
    .returns<QuestionRow[]>();

  const questionList = questions ?? [];
  const nextSortOrder = questionList.length > 0 ? Math.max(...questionList.map((q) => q.sort_order)) + 1 : 1;

  const questionIds = questionList.map((q) => q.id);
  const { data: answeredRows } =
    questionIds.length > 0
      ? await supabase.from('survey_answers').select('question_id').in('question_id', questionIds)
      : { data: [] as { question_id: string }[] };
  const answeredQuestionIds = new Set((answeredRows ?? []).map((a) => a.question_id));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/admin/surveys" className="text-sm text-neutral-500 hover:underline">
        ← Volver a encuestas
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{template.title}</h1>
      {template.description && (
        <p className="mt-1 text-sm text-neutral-500">{template.description}</p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-brand-blue hover:underline">
          Editar detalles de la encuesta
        </summary>
        <form action={updateTemplate} className="mt-2 flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
          <input type="hidden" name="id" value={template.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="edit-title">
              Título
            </label>
            <input
              id="edit-title"
              name="title"
              defaultValue={template.title}
              required
              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="edit-target">
              Dirigida a
            </label>
            <select
              id="edit-target"
              name="target"
              defaultValue={template.target}
              required
              className="w-fit rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            >
              {TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="edit-description">
              Descripción (se muestra a quien responde)
            </label>
            <textarea
              id="edit-description"
              name="description"
              rows={2}
              defaultValue={template.description ?? ''}
              className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-fit rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
          >
            Guardar detalles
          </button>
        </form>
      </details>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {questionList.map((q, idx) => {
          const hasAnswers = answeredQuestionIds.has(q.id);
          return (
            <div
              key={q.id}
              className={`rounded-xl border p-3 ${
                q.is_active ? 'border-neutral-200 bg-white' : 'border-neutral-200 bg-neutral-50 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {idx + 1}. {q.question_text}
                    {!q.is_active && (
                      <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-normal text-neutral-600">
                        Inactiva
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {TYPE_LABELS[q.question_type] ?? q.question_type}
                    {q.question_type === 'escala' ? ` (${q.scale_min}-${q.scale_max})` : ''}
                    {q.options ? ` — ${q.options.join(', ')}` : ''}
                    {!q.is_required ? ' · opcional' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <form action={moveQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="template_id" value={templateId} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={idx === 0}
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="template_id" value={templateId} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={idx === questionList.length - 1}
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>
                  {hasAnswers ? (
                    <form action={toggleQuestionActive}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="template_id" value={templateId} />
                      <input type="hidden" name="next" value={(!q.is_active).toString()} />
                      <button
                        type="submit"
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
                      >
                        {q.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                  ) : (
                    <form action={deleteQuestion}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="template_id" value={templateId} />
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-brand-blue hover:underline">Editar</summary>
                <form
                  action={updateQuestion}
                  className="mt-2 flex flex-col gap-3 rounded-lg border border-neutral-200 p-3"
                >
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="template_id" value={templateId} />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">Pregunta</label>
                    <input
                      name="question_text"
                      defaultValue={q.question_text}
                      required
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">Tipo</label>
                    {hasAnswers ? (
                      <>
                        <input type="hidden" name="question_type" value={q.question_type} />
                        <p className="text-sm text-neutral-600">
                          {TYPE_LABELS[q.question_type] ?? q.question_type}{' '}
                          <span className="text-xs text-neutral-400">
                            (bloqueado: ya tiene respuestas guardadas)
                          </span>
                        </p>
                      </>
                    ) : (
                      <select
                        name="question_type"
                        defaultValue={q.question_type}
                        required
                        className="w-fit rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      >
                        <option value="escala">Escala</option>
                        <option value="opcion_multiple">Opción múltiple</option>
                        <option value="texto_libre">Texto libre</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-neutral-500">Escala: mínimo</label>
                      <input
                        name="scale_min"
                        type="number"
                        defaultValue={q.scale_min}
                        className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-neutral-500">Escala: máximo</label>
                      <input
                        name="scale_max"
                        type="number"
                        defaultValue={q.scale_max}
                        className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <p className="pb-1.5 text-xs text-neutral-400">Solo aplica si el tipo es &quot;Escala&quot;.</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">
                      Opciones (solo si es &quot;Opción múltiple&quot; — una por línea)
                    </label>
                    <textarea
                      name="options"
                      rows={3}
                      defaultValue={(q.options ?? []).join('\n')}
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <label className="flex w-fit items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" name="is_required" defaultChecked={q.is_required} className="h-4 w-4" />
                    Obligatoria
                  </label>
                  <button
                    type="submit"
                    className="w-fit rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
                  >
                    Guardar cambios
                  </button>
                </form>
              </details>
            </div>
          );
        })}
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
            <option value="escala">Escala</option>
            <option value="opcion_multiple">Opción múltiple</option>
            <option value="texto_libre">Texto libre</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="scale_min">
              Escala: mínimo
            </label>
            <input
              id="scale_min"
              name="scale_min"
              type="number"
              defaultValue={1}
              className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="scale_max">
              Escala: máximo
            </label>
            <input
              id="scale_max"
              name="scale_max"
              type="number"
              defaultValue={5}
              className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <p className="pb-1.5 text-xs text-neutral-400">Solo aplica si el tipo es &quot;Escala&quot;.</p>
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
        <label className="flex w-fit items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="is_required" defaultChecked className="h-4 w-4" />
          Obligatoria
        </label>
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
