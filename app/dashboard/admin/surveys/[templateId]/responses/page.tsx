import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type QuestionRow = { id: string; question_text: string; sort_order: number };
type ResponseRow = { id: string; user_id: string; submitted_at: string };
type AnswerRow = { response_id: string; question_id: string; answer_value: unknown };
type AthleteName = { id: string; full_name: string };

export default async function SurveyResponsesPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('survey_templates')
    .select('id, title')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) {
    redirect('/dashboard/admin/surveys');
  }

  const [{ data: questions }, { data: responses }] = await Promise.all([
    supabase
      .from('survey_questions')
      .select('id, question_text, sort_order')
      .eq('template_id', templateId)
      .order('sort_order')
      .returns<QuestionRow[]>(),
    supabase
      .from('survey_responses')
      .select('id, user_id, submitted_at')
      .eq('template_id', templateId)
      .order('submitted_at', { ascending: false })
      .returns<ResponseRow[]>(),
  ]);

  const questionList = questions ?? [];
  const responseList = responses ?? [];
  const responseIds = responseList.map((r) => r.id);
  const userIds = [...new Set(responseList.map((r) => r.user_id))];

  const [{ data: answers }, { data: athletes }] = await Promise.all([
    responseIds.length > 0
      ? supabase
          .from('survey_answers')
          .select('response_id, question_id, answer_value')
          .in('response_id', responseIds)
          .returns<AnswerRow[]>()
      : Promise.resolve({ data: [] as AnswerRow[] }),
    userIds.length > 0
      ? supabase.from('athlete_profiles').select('id, full_name').in('id', userIds).returns<AthleteName[]>()
      : Promise.resolve({ data: [] as AthleteName[] }),
  ]);

  const nameById = new Map((athletes ?? []).map((a) => [a.id, a.full_name]));
  const answersByResponse = new Map<string, Map<string, unknown>>();
  for (const a of answers ?? []) {
    if (!answersByResponse.has(a.response_id)) answersByResponse.set(a.response_id, new Map());
    answersByResponse.get(a.response_id)!.set(a.question_id, a.answer_value);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <a href={`/dashboard/admin/surveys/${templateId}`} className="text-sm text-neutral-500 hover:underline">
        ← Volver a la encuesta
      </a>
      <h1 className="mt-2 text-xl font-semibold text-neutral-900">
        Respuestas — {template.title}
      </h1>

      <div className="mt-6 flex flex-col gap-4">
        {responseList.map((r) => (
          <div key={r.id} className="rounded-xl border border-neutral-200 p-4">
            <p className="text-sm font-medium text-neutral-900">
              {nameById.get(r.user_id) ?? '—'}
            </p>
            <p className="text-xs text-neutral-500">
              {new Date(r.submitted_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <dl className="mt-2 flex flex-col gap-1">
              {questionList.map((q) => (
                <div key={q.id} className="text-sm">
                  <dt className="text-neutral-500">{q.question_text}</dt>
                  <dd className="text-neutral-900">
                    {String(answersByResponse.get(r.id)?.get(q.id) ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {responseList.length === 0 && (
          <p className="text-sm text-neutral-500">Nadie ha respondido todavía.</p>
        )}
      </div>
    </div>
  );
}
