'use client';

import { useMemo, useState } from 'react';
import { updateUser, assignCoachTeams } from './actions';
import { ResetPasswordButton } from './ResetPasswordButton';
import { DeleteUserButton } from './DeleteUserButton';
import { AddRoleButton } from './AddRoleButton';
import { RoleBadges } from './RoleBadges';

// Una fila por PERSONA -- roles es TODOS los roles que tiene, no uno solo
// (antes era "role" singular y una persona con 2+ roles aparecía duplicada,
// una fila por membership).
type ProfileRow = {
  id: string;
  full_name: string;
  cedula: string;
  email: string;
  roles: string[];
  status: string;
  position: string | null;
};

type TeamOption = { id: string; name: string; divisionName: string | null };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  scorekeeper: 'Scorekeeper',
  deportista: 'Deportista',
};

const POSITION_LABELS: Record<string, string> = {
  jugador_de_campo: 'Jugador de campo',
  portero: 'Portero',
};

type SortKey = 'full_name' | 'cedula' | 'email' | 'role' | 'status' | 'position';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'full_name', label: 'Nombre' },
  { key: 'cedula', label: 'Cédula' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Rol' },
  { key: 'status', label: 'Estado' },
  { key: 'position', label: 'Posición' },
];

function sortValue(p: ProfileRow, key: SortKey): string {
  switch (key) {
    case 'role':
      return p.roles
        .map((r) => ROLE_LABELS[r] ?? r)
        .sort()
        .join(', ');
    case 'position':
      return p.position ? POSITION_LABELS[p.position] ?? p.position : '';
    default:
      return (p[key] ?? '').toLowerCase();
  }
}

export function UsersTable({
  profiles,
  teamOptions,
  coachTeamsByCoach,
  editId,
  assignId,
}: {
  profiles: ProfileRow[];
  teamOptions: TeamOption[];
  coachTeamsByCoach: Record<string, string[]>;
  editId?: string;
  assignId?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [query, setQuery] = useState('');

  // `profiles` ya viene filtrada por rol desde el servidor (page.tsx agrupa
  // por persona y aplica ?role= ahí) -- el buscador filtra en el cliente,
  // en tiempo real, SOBRE ese resultado ya filtrado, así que ambos filtros
  // quedan combinados (AND) en vez de que uno reemplace al otro. Por
  // nombre parcial (case-insensitive) o cédula (substring, no requiere
  // match exacto).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => p.full_name.toLowerCase().includes(q) || p.cedula.toLowerCase().includes(q));
  }, [profiles, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const colCount = COLUMNS.length + 1;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre o cédula..."
        className="mt-4 w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => handleSort(c.key)}
                  className="flex items-center gap-1 hover:text-neutral-900"
                >
                  {c.label}
                  {sortKey === c.key && <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) =>
            editId === p.id ? (
              <tr key={p.id} className="border-b border-neutral-100">
                <td colSpan={colCount} className="bg-brand-blue/5 p-4">
                  <form action={updateUser} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-neutral-500">Nombre</label>
                      <input
                        name="full_name"
                        defaultValue={p.full_name}
                        required
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-neutral-500">Estado</label>
                      <select
                        name="status"
                        defaultValue={p.status}
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      >
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                    </div>
                    {p.roles.includes('deportista') && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-neutral-500">Posición</label>
                        <select
                          name="position"
                          defaultValue={p.position ?? 'jugador_de_campo'}
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                        >
                          <option value="jugador_de_campo">Jugador de campo</option>
                          <option value="portero">Portero</option>
                        </select>
                      </div>
                    )}
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
                    >
                      Guardar
                    </button>
                    <a href="/dashboard/admin/users" className="text-sm text-neutral-500 hover:underline">
                      Cancelar
                    </a>
                  </form>
                </td>
              </tr>
            ) : assignId === p.id ? (
              <tr key={p.id} className="border-b border-neutral-100">
                <td colSpan={colCount} className="bg-brand-blue/5 p-4">
                  <p className="text-sm font-medium text-neutral-700">Equipos de {p.full_name}</p>
                  <form action={assignCoachTeams} className="mt-2 flex flex-col gap-3">
                    <input type="hidden" name="coach_id" value={p.id} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {teamOptions.map((t) => (
                        <label key={t.id} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            name="team_ids"
                            value={t.id}
                            defaultChecked={coachTeamsByCoach[p.id]?.includes(t.id) ?? false}
                          />
                          {t.name}
                          {t.divisionName ? ` (${t.divisionName})` : ''}
                        </label>
                      ))}
                      {teamOptions.length === 0 && <p className="text-sm text-neutral-500">No hay equipos creados.</p>}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
                      >
                        Guardar
                      </button>
                      <a href="/dashboard/admin/users" className="text-sm text-neutral-500 hover:underline">
                        Cancelar
                      </a>
                    </div>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-2 font-medium text-neutral-900">{p.full_name}</td>
                <td className="px-3 py-2 text-neutral-700">{p.cedula}</td>
                <td className="px-3 py-2 text-neutral-700">{p.email}</td>
                <td className="px-3 py-2">
                  <RoleBadges personId={p.id} roles={p.roles} />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      p.status === 'activo'
                        ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                        : 'rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600'
                    }
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-700">
                  {p.roles.includes('deportista') && p.position ? POSITION_LABELS[p.position] ?? p.position : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {p.roles.includes('deportista') && (
                      <a href={`/dashboard/reports/athletes/${p.id}`} className="text-brand-blue hover:underline">
                        Ver perfil
                      </a>
                    )}
                    <a href={`/dashboard/admin/users?edit=${p.id}`} className="text-brand-blue hover:underline">
                      Editar
                    </a>
                    {p.roles.includes('coach') && (
                      <a href={`/dashboard/admin/users?assign=${p.id}`} className="text-brand-blue hover:underline">
                        Asignar equipos
                      </a>
                    )}
                    <AddRoleButton personId={p.id} existingRoles={p.roles} />
                    <ResetPasswordButton userId={p.id} />
                    <DeleteUserButton userId={p.id} userName={p.full_name} />
                  </div>
                </td>
              </tr>
            )
          )}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={colCount} className="px-3 py-4 text-center text-neutral-500">
                No hay usuarios con ese filtro.
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}
