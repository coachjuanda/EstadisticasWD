import { createClient } from '@/lib/supabase/server';
import { getActiveMembership, getMemberships } from '@/lib/auth/activeMembership';
import { RoleSwitcher } from './RoleSwitcher';

// Chrome compartido para todo /dashboard/* -- SOLO agrega el switcher de rol
// (visible nada más si hay 2+ memberships). El guard de auth de cada
// sub-área (coach/athlete/scorekeeper/admin layouts, o cada page suelta)
// sigue siendo la puerta real; este layout no redirige por su cuenta para
// no duplicar esa lógica.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const membership = await getActiveMembership(supabase);

  if (!membership) {
    return <>{children}</>;
  }

  const memberships = await getMemberships(supabase);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {memberships.length > 1 && (
        <div className="flex justify-end border-b border-neutral-200 bg-white px-4 py-2">
          <RoleSwitcher currentMembershipId={membership.membershipId} memberships={memberships} />
        </div>
      )}
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
