'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/activeMembership';

const BASE_PATH = '/dashboard/admin/evaluations';

async function requireAdmin() {
  const supabase = await createClient();
  const membership = await requireRole(supabase, 'admin');

  return { supabase, clubId: membership.clubId };
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
