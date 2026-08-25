'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function submitResponse(formData: FormData) {
  const template_id = formData.get('template_id') as string;
  if (!template_id) {
    redirect('/dashboard/athlete/surveys');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, question_type')
    .eq('template_id', template_id);

  const typeByQuestion = new Map((questions ?? []).map((q) => [q.id, q.question_type]));

  const { data: response, error: responseError } = await supabase
    .from('survey_responses')
    .insert({ template_id, user_id: user.id })
    .select('id')
    .single();

  if (responseError) {
    redirect(
      `/dashboard/athlete/surveys/${template_id}?error=${encodeURIComponent(responseError.message)}`
    );
  }

  const answers: { response_id: string; question_id: string; answer_value: number | string }[] = [];
  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith('answer_')) continue;
    const questionId = key.slice('answer_'.length);
    const type = typeByQuestion.get(questionId);
    const value = String(rawValue);
    if (!value) continue;
    answers.push({
      response_id: response.id,
      question_id: questionId,
      answer_value: type === 'escala' ? Number(value) : value,
    });
  }

  const { error: answersError } = await supabase.from('survey_answers').insert(answers);

  if (answersError) {
    redirect(
      `/dashboard/athlete/surveys/${template_id}?error=${encodeURIComponent(answersError.message)}`
    );
  }

  revalidatePath('/dashboard/athlete/surveys');
  redirect('/dashboard/athlete/surveys');
}
