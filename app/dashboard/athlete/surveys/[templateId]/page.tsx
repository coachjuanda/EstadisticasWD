import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { submitResponse } from '../actions';

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

export default async function AthleteSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { templateId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: template } = await supabase
    .from('survey_templates')
    .select('id, title, description')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) {
    redirect('/dashboard/athlete/surveys');
  }

  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, question_text, question_type, options, sort_order, scale_min, scale_max, is_required, is_active')
    .eq('template_id', templateId)
    .order('sort_order')
    .returns<QuestionRow[]>();

  // La vista de "ya respondiste" muestra todas las preguntas (incluidas las
  // desactivadas después) para no perder el historial. El formulario para
  // responder de nuevo solo debe ofrecer las que siguen activas.
  const questionList = questions ?? [];
  const activeQuestionList = questionList.filter((q) => q.is_active);

  const { data: existingResponse } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('template_id', templateId)
    .eq('user_id', user!.id)
    .maybeSingle();

  if (existingResponse) {
    const { data: answers } = await supabase
      .from('survey_answers')
      .select('question_id, answer_value')
      .eq('response_id', existingResponse.id);

    const answerByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a.answer_value]));

    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-semibold text-neutral-900">{template.title}</h1>
        {template.description && (
          <p className="mt-1 text-sm text-neutral-500">{template.description}</p>
        )}
        <p className="mt-1 text-sm text-neutral-500">Ya respondiste esta encuesta.</p>
        <div className="mt-4 flex flex-col gap-3">
          {questionList.map((q) => (
            <div key={q.id} className="rounded-xl border border-neutral-200 p-3">
              <p className="text-sm font-medium text-neutral-900">{q.question_text}</p>
              <p className="text-sm text-neutral-600">
                {String(answerByQuestion.get(q.id) ?? '—')}
              </p>
            </div>
          ))}
        </div>
        <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
          ← Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">{template.title}</h1>
      {template.description && (
        <p className="mt-1 text-sm text-neutral-500">{template.description}</p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={submitResponse} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="template_id" value={templateId} />
        {activeQuestionList.map((q) => (
          <div key={q.id} className="rounded-xl border border-neutral-200 p-3">
            <p className="text-sm font-medium text-neutral-900">
              {q.question_text}
              {!q.is_required && <span className="ml-1 font-normal text-neutral-400">(opcional)</span>}
            </p>

            {q.question_type === 'escala' && (
              <div className="mt-2 flex flex-wrap gap-3">
                {Array.from(
                  { length: q.scale_max - q.scale_min + 1 },
                  (_, i) => q.scale_min + i
                ).map((n) => (
                  <label key={n} className="flex flex-col items-center gap-1 text-xs text-neutral-600">
                    <input type="radio" name={`answer_${q.id}`} value={n} required={q.is_required} />
                    {n}
                  </label>
                ))}
              </div>
            )}

            {q.question_type === 'opcion_multiple' && (
              <div className="mt-2 flex flex-col gap-1">
                {(q.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="radio" name={`answer_${q.id}`} value={opt} required={q.is_required} />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.question_type === 'texto_libre' && (
              <textarea
                name={`answer_${q.id}`}
                rows={3}
                required={q.is_required}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
              />
            )}
          </div>
        ))}
        {activeQuestionList.length === 0 && (
          <p className="text-sm text-neutral-500">Esta encuesta todavía no tiene preguntas.</p>
        )}
        <button
          type="submit"
          disabled={activeQuestionList.length === 0}
          className="w-fit rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
        >
          Enviar respuestas
        </button>
      </form>
      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
