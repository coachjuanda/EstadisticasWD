'use client';

import { useRef } from 'react';
import { selectRoleAction } from '@/app/select-role/actions';
import type { UserRole } from '@/lib/auth/activeMembership';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  coach: 'Coach',
  scorekeeper: 'Anotador',
  deportista: 'Deportista',
};

export function RoleSwitcher({
  currentMembershipId,
  memberships,
}: {
  currentMembershipId: string;
  memberships: { id: string; role: UserRole }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={selectRoleAction} className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500">Entraste como</span>
      <select
        name="membership_id"
        value={currentMembershipId}
        onChange={(e) => {
          e.currentTarget.form?.requestSubmit();
        }}
        className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-neutral-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      >
        {memberships.map((m) => (
          <option key={m.id} value={m.id}>
            {ROLE_LABELS[m.role]}
          </option>
        ))}
      </select>
    </form>
  );
}
