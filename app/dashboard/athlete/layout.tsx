import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/activeMembership';

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requireRole(supabase, 'deportista');

  return <div className="min-h-full flex-1 bg-neutral-50">{children}</div>;
}
