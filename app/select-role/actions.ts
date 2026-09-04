'use server';

import { redirect } from 'next/navigation';
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

  redirect('/dashboard');
}
