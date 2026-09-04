import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/activeMembership';

export default async function ScorekeeperLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requireRole(supabase, 'scorekeeper');

  return <div className="min-h-full flex-1 bg-neutral-50">{children}</div>;
}
