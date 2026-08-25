'use client';

import { useActionState, useState } from 'react';
import { createUserAction, type CreateUserState } from './actions';
import { PasswordModeFields } from './PasswordModeFields';

type Team = { id: string; name: string; divisionName: string | null };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  scorekeeper: 'Scorekeeper',
  deportista: 'Deportista',
};

const initialState: CreateUserState = { status: 'idle' };

export function CreateUserForm({ teams }: { teams: Team[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const [role, setRole] = useState('deportista');

  if (state.status === 'success') {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="font-semibold text-amber-900">
          Usuario creado: {state.fullName} ({ROLE_LABELS[state.role] ?? state.role})
        </p>
        {state.passwordMode === 'auto' ? (
          <>
            <p className="mt-2 text-sm text-amber-800">
              Contraseña temporal — cópiala ahora, no se puede volver a ver:
            </p>
            <code className="mt-1 block select-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-neutral-900">
              {state.password}
            </code>
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-800">
            Se guardó la contraseña que asignaste.
          </p>
        )}
        <p className="mt-2 text-xs text-amber-700">
          Cédula: {state.cedula} · Email: {state.email}
        </p>
        <a
          href="/dashboard/admin/users"
          className="mt-4 inline-block rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Crear otro usuario
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border border-neutral-200 p-4">
      {state.status === 'error' && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="full_name">
            Nombre completo
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="cedula">
            Cédula
          </label>
          <input
            id="cedula"
            name="cedula"
            required
            inputMode="numeric"
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="role">
            Rol
          </label>
          <select
            id="role"
            name="role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="deportista">Deportista</option>
            <option value="coach">Entrenador</option>
            <option value="scorekeeper">Scorekeeper</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>

      {role === 'deportista' && (
        <div className="mt-4 flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="position">
            Posición
          </label>
          <select
            id="position"
            name="position"
            defaultValue="jugador_de_campo"
            className="w-fit rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="jugador_de_campo">Jugador de campo</option>
            <option value="portero">Portero</option>
          </select>
        </div>
      )}

      {role === 'coach' && (
        <div className="mt-4">
          <p className="text-xs font-medium text-neutral-500">
            Equipos que le corresponden
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {teams.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="team_ids" value={t.id} />
                {t.name}
                {t.divisionName ? ` (${t.divisionName})` : ''}
              </label>
            ))}
            {teams.length === 0 && (
              <p className="text-sm text-neutral-500">No hay equipos creados.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <PasswordModeFields idPrefix="create" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
      >
        {pending ? 'Creando...' : 'Crear usuario'}
      </button>
    </form>
  );
}
