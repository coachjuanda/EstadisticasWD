'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function selectRoleAction(formData: FormData) {
  const membershipId = formData.get('membership_id') as string;
  if (!membershipId) {
    redirect(`/select-role?error=${encodeURIComponent('Falta el rol.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_active_membership', { p_membership_id: membershipId });

  if (error) {
    redirect(`/select-role?error=${encodeURIComponent(error.message)}`);
  }

  // app/dashboard/layout.tsx (el switcher) y cada guard de rol por sub-área
  // leen la membership activa una sola vez por render -- sin esto, el
  // router cache del cliente sigue sirviendo esa data vieja después del
  // redirect: el contenido de la página cambia (porque su propio segmento sí
  // se revalida), pero el layout compartido -- y por lo tanto el <select>
  // del switcher -- se queda mostrando el rol anterior hasta un refresh
  // completo, aunque el rol activo real ya cambió en la base.
  revalidatePath('/dashboard', 'layout');

  redirect('/dashboard');
}
