'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/activeMembership';

const BASE_PATH = '/dashboard/admin/surveys';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23503') {
    return 'No se puede eliminar: hay respuestas registradas para esto.';
  }
  return error.message;
}

async function getClubId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const membership = await getActiveMembership(supabase);
  if (!membership) redirect('/login');

  return { clubId: membership.clubId, userId: membership.personId };
}

export async function createTemplate(formData: FormData) {
  const title = (formData.get('title') as string)?.trim();
  const target = formData.get('target') as string;
  const description = (formData.get('description') as string)?.trim() || null;

  if (!title || !target) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Título y a quién va dirigida son obligatorios.')}`);
  }

  const supabase = await createClient();
  const { clubId, userId } = await getClubId(supabase);

  const { data, error } = await supabase
    .from('survey_templates')
    .insert({ title, target, description, club_id: clubId, created_by: userId })
    .select('id')
    .single();

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}/${data.id}`);
}

export async function updateTemplate(formData: FormData) {
  const id = formData.get('id') as string;
  const title = (formData.get('title') as string)?.trim();
  const target = formData.get('target') as string;
  const description = (formData.get('description') as string)?.trim() || null;

  if (!id || !title || !target) {
    redirect(`${BASE_PATH}/${id}?error=${encodeURIComponent('Título y a quién va dirigida son obligatorios.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('survey_templates')
    .update({ title, target, description })
    .eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}/${id}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(`${BASE_PATH}/${id}`);
  redirect(`${BASE_PATH}/${id}`);
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
  const scale_min = Number(formData.get('scale_min') ?? 1);
  const scale_max = Number(formData.get('scale_max') ?? 5);
  const is_required = formData.get('is_required') === 'on';

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

  if (question_type === 'escala' && scale_max <= scale_min) {
    redirect(
      `${BASE_PATH}/${template_id}?error=${encodeURIComponent('El máximo de la escala debe ser mayor que el mínimo.')}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from('survey_questions').insert({
    template_id,
    question_text,
    question_type,
    options,
    sort_order,
    scale_min,
    scale_max,
    is_required,
  });

  if (error) {
    redirect(`${BASE_PATH}/${template_id}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(`${BASE_PATH}/${template_id}`);
  redirect(`${BASE_PATH}/${template_id}`);
}

export async function updateQuestion(formData: FormData) {
  const id = formData.get('id') as string;
  const template_id = formData.get('template_id') as string;
  const question_text = (formData.get('question_text') as string)?.trim();
  const question_type = formData.get('question_type') as string;
  const optionsRaw = (formData.get('options') as string) ?? '';
  const scale_min = Number(formData.get('scale_min') ?? 1);
  const scale_max = Number(formData.get('scale_max') ?? 5);
  const is_required = formData.get('is_required') === 'on';

  if (!id || !template_id || !question_text || !question_type) {
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

  if (question_type === 'escala' && scale_max <= scale_min) {
    redirect(
      `${BASE_PATH}/${template_id}?error=${encodeURIComponent('El máximo de la escala debe ser mayor que el mínimo.')}`
    );
  }

  const supabase = await createClient();

  // El tipo puede venir bloqueado desde el form (hidden input) si la
  // pregunta ya tiene respuestas -- pero igual lo revalidamos server-side
  // por si alguien manda el request directo saltándose el HTML.
  const { data: current } = await supabase
    .from('survey_questions')
    .select('question_type')
    .eq('id', id)
    .maybeSingle();

  if (current && current.question_type !== question_type) {
    const { count } = await supabase
      .from('survey_answers')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', id);

    if ((count ?? 0) > 0) {
      redirect(
        `${BASE_PATH}/${template_id}?error=${encodeURIComponent('No se puede cambiar el tipo de esta pregunta: ya tiene respuestas guardadas y cambiar el tipo invalidaría su interpretación.')}`
      );
    }
  }

  const { error } = await supabase
    .from('survey_questions')
    .update({ question_text, question_type, options, scale_min, scale_max, is_required })
    .eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}/${template_id}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(`${BASE_PATH}/${template_id}`);
  redirect(`${BASE_PATH}/${template_id}`);
}

export async function moveQuestion(formData: FormData) {
  const id = formData.get('id') as string;
  const template_id = formData.get('template_id') as string;
  const direction = formData.get('direction') as 'up' | 'down';

  const supabase = await createClient();
  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, sort_order')
    .eq('template_id', template_id)
    .order('sort_order');

  const list = questions ?? [];
  const idx = list.findIndex((q) => q.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;

  if (idx === -1 || targetIdx < 0 || targetIdx >= list.length) {
    redirect(`${BASE_PATH}/${template_id}`);
  }

  const current = list[idx];
  const target = list[targetIdx];

  await supabase.from('survey_questions').update({ sort_order: target.sort_order }).eq('id', current.id);
  await supabase.from('survey_questions').update({ sort_order: current.sort_order }).eq('id', target.id);

  revalidatePath(`${BASE_PATH}/${template_id}`);
  redirect(`${BASE_PATH}/${template_id}`);
}

export async function toggleQuestionActive(formData: FormData) {
  const id = formData.get('id') as string;
  const template_id = formData.get('template_id') as string;
  const next = formData.get('next') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.from('survey_questions').update({ is_active: next }).eq('id', id);

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
    const message =
      error.code === '23503'
        ? 'No se puede eliminar: esta pregunta ya tiene respuestas guardadas. Desactívala en su lugar para que deje de aparecer sin perder el historial.'
        : friendlyError(error);
    redirect(`${BASE_PATH}/${template_id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`${BASE_PATH}/${template_id}`);
  redirect(`${BASE_PATH}/${template_id}`);
}
