'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/evaluations';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, club_id').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard?error=unauthorized');

  return { supabase, clubId: profile.club_id as string };
}

// Se reutiliza tanto para fijar como para quitar la fecha: un valor vacío
// (o ausente, como en el formulario de "Quitar fecha límite") vuelve
// evaluation_deadline a null, que es exactamente "usar la regla individual
// de 2 meses" para el semáforo de vencimiento.
export async function setEvaluationDeadline(formData: FormData) {
  const { supabase, clubId } = await requireAdmin();
  const deadline = ((formData.get('evaluation_deadline') as string) ?? '').trim();

  const { error } = await supabase
    .from('clubs')
    .update({ evaluation_deadline: deadline || null })
    .eq('id', clubId);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(BASE_PATH);
  revalidatePath('/dashboard/coach/evaluations');
  redirect(BASE_PATH);
}
