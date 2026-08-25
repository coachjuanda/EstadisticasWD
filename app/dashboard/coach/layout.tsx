import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'coach') {
    redirect('/dashboard?error=unauthorized');
  }

  return <div className="min-h-full flex-1 bg-neutral-50">{children}</div>;
}
