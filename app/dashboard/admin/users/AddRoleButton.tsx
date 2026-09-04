'use client';

import { useState } from 'react';
import { addRoleAction } from './actions';

const ALL_ROLES = ['admin', 'coach', 'scorekeeper', 'deportista'] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  scorekeeper: 'Scorekeeper',
  deportista: 'Deportista',
};

export function AddRoleButton({ personId, existingRoles }: { personId: string; existingRoles: string[] }) {
  const [open, setOpen] = useState(false);
  const availableRoles = ALL_ROLES.filter((r) => !existingRoles.includes(r));

  if (availableRoles.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-500 hover:underline">
        Agregar rol
      </button>
    );
  }

  return (
    <form
      action={addRoleAction}
      className="mt-2 flex w-56 flex-col gap-2 rounded-lg border border-neutral-300 bg-white p-2"
    >
      <input type="hidden" name="person_id" value={personId} />
      <select
        name="role"
        defaultValue={availableRoles[0]}
        className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
      >
        {availableRoles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-brand-blue px-2 py-1 text-xs font-semibold text-white hover:bg-brand-blue-hover"
        >
          Agregar
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
