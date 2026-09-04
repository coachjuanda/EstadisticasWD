'use client';

import { removeRoleAction } from './actions';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  scorekeeper: 'Scorekeeper',
  deportista: 'Deportista',
};

// Una etiqueta por rol de la persona. Cada una es su propio mini-form a
// removeRoleAction -- la "x" solo aparece si tiene más de 1 rol (nunca se
// puede dejar a alguien sin ninguno desde acá; para eso está "Eliminar").
export function RoleBadges({ personId, roles }: { personId: string; roles: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => {
        const label = ROLE_LABELS[role] ?? role;
        return (
          <form
            key={role}
            action={removeRoleAction}
            className="inline-flex"
            onSubmit={(e) => {
              if (!confirm(`¿Quitar el rol ${label}?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="person_id" value={personId} />
            <input type="hidden" name="role" value={role} />
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
              {label}
              {roles.length > 1 && (
                <button
                  type="submit"
                  title={`Quitar rol ${label}`}
                  className="text-neutral-400 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </span>
          </form>
        );
      })}
    </div>
  );
}
