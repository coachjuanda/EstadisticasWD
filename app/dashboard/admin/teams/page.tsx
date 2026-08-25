import { createClient } from '@/lib/supabase/server';
import { createTeam, updateTeam, deleteTeam } from './actions';

type TeamRow = {
  id: string;
  name: string;
  division_id: string;
  divisions: { name: string } | null;
};

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const { error, edit } = await searchParams;
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, division_id, divisions(name)')
    .order('name')
    .returns<TeamRow[]>();

  const { data: divisions } = await supabase.from('divisions').select('id, name').order('name');

  const hasDivisions = (divisions ?? []).length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-neutral-900">Equipos</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!hasDivisions && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Todavía no hay divisiones creadas.{' '}
          <a href="/dashboard/admin/divisions" className="underline">
            Crea una primero
          </a>
          .
        </p>
      )}

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            <th className="py-2 font-medium">Nombre</th>
            <th className="py-2 font-medium">División</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(teams ?? []).map((team) =>
            edit === team.id ? (
              <tr key={team.id} className="border-b border-neutral-100">
                <td colSpan={3} className="py-3">
                  <form action={updateTeam} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={team.id} />
                    <input
                      name="name"
                      defaultValue={team.name}
                      required
                      className="rounded-lg border border-neutral-300 px-2 py-1"
                    />
                    <select
                      name="division_id"
                      defaultValue={team.division_id}
                      required
                      className="rounded-lg border border-neutral-300 px-2 py-1"
                    >
                      {(divisions ?? []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-blue px-3 py-1 text-white hover:bg-brand-blue-hover"
                    >
                      Guardar
                    </button>
                    <a href="/dashboard/admin/teams" className="text-neutral-500 hover:underline">
                      Cancelar
                    </a>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={team.id} className="border-b border-neutral-100">
                <td className="py-2">{team.name}</td>
                <td className="py-2">{team.divisions?.name ?? '—'}</td>
                <td className="py-2 text-right">
                  <a href={`/dashboard/team-stats/${team.id}`} className="mr-3 text-brand-blue hover:underline">
                    Ver estadísticas
                  </a>
                  <a
                    href={`/dashboard/admin/teams?edit=${team.id}`}
                    className="mr-3 text-brand-blue hover:underline"
                  >
                    Editar
                  </a>
                  <form action={deleteTeam} className="inline">
                    <input type="hidden" name="id" value={team.id} />
                    <button type="submit" className="text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            )
          )}
          {(teams ?? []).length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-neutral-500">
                No hay equipos todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">
        Crear nuevo equipo
      </h2>
      <form action={createTeam} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="team-name">
            Nombre
          </label>
          <input
            id="team-name"
            name="name"
            required
            placeholder="Ej. Wild Dogs U12"
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="division_id">
            División
          </label>
          <select
            id="division_id"
            name="division_id"
            required
            disabled={!hasDivisions}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            {(divisions ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!hasDivisions}
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
        >
          Crear
        </button>
      </form>
    </div>
  );
}
