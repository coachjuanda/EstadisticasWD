import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/activeMembership';
import { AdminShell } from './AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requireRole(supabase, 'admin');

  return <AdminShell>{children}</AdminShell>;
}
