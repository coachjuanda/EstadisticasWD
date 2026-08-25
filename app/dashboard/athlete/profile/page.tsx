import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AthleteOwnProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  redirect(`/dashboard/reports/athletes/${user.id}`);
}
