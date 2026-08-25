'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/surveys';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23503') {
    return 'No se puede eliminar: hay respuestas registradas para esto.';
  }
  return error.message;
}

async function getClubId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('club_id').eq('id', user.id).single();
  return { clubId: profile?.club_id as string, userId: user.id };
}

export async function createTemplate(formData: FormData) {
  const title = (formData.get('title') as string)?.trim();
  const target = formData.get('target') as string;

  if (!title || !target) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Título y a quién va dirigida son obligatorios.')}`);
  }

  const supabase = await createClient();
  const { clubId, userId } = await getClubId(supabase);

  const { data, error } = await supabase
    .from('survey_templates')
    .insert({ title, target, club_id: clubId, created_by: userId })
    .select('id')
    .single();

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}/${data.id}`);
}

export async function deleteTemplate(formData: FormData) {
  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { error } = await supabase.from('survey_templates').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function addQuestion(formData: FormData) {
  const template_id = formData.get('template_id') as string;
  const question_text = (formData.get('question_text') as string)?.trim();
  const question_type = formData.get('question_type') as string;
  const optionsRaw = (formData.get('options') as string) ?? '';
  const sort_order = Number(formData.get('sort_order') ?? 0);

  if (!template_id || !question_text || !question_type) {
    redirect(`${BASE_PATH}/${template_id}?error=${encodeURIComponent('Falta el texto o el tipo de pregunta.')}`);
  }

  const options =
    question_type === 'opcion_multiple'
      ? optionsRaw
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

  if (question_type === 'opcion_multiple' && (!options || options.length < 2)) {
    redirect(
      `${BASE_PATH}/${template_id}?error=${encodeURIComponent('Opción múltiple necesita al menos 2 opciones (una por línea).')}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('survey_questions')
    .insert({ template_id, question_text, question_type, options, sort_order });

  if (error) {
    redirect(`${BASE_PATH}/${template_id}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(`${BASE_PATH}/${template_id}`);
  redirect(`${BASE_PATH}/${template_id}`);
}

export async function deleteQuestion(formData: FormData) {
  const id = formData.get('id') as string;
  const template_id = formData.get('template_id') as string;

  const supabase = await createClient();
  const { error } = await supabase.from('survey_questions').delete().eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}/${template_id}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(`${BASE_PATH}/${template_id}`);
  redirect(`${BASE_PATH}/${template_id}`);
}
