import { createClient } from '@/lib/supabase/server';
import { createDivision, updateDivision, deleteDivision } from './actions';

const SPORT_LABELS: Record<string, string> = {
  hockey_linea: 'Hockey en línea',
  hockey_hielo: 'Hockey en hielo',
};

export default async function DivisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const { error, edit } = await searchParams;
  const supabase = await createClient();

  const { data: divisions } = await supabase
    .from('divisions')
    .select('id, name, sport')
    .order('name');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-neutral-900">Divisiones</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            <th className="py-2 font-medium">Nombre</th>
            <th className="py-2 font-medium">Deporte</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(divisions ?? []).map((division) =>
            edit === division.id ? (
              <tr key={division.id} className="border-b border-neutral-100">
                <td colSpan={3} className="py-3">
                  <form action={updateDivision} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={division.id} />
                    <input
                      name="name"
                      defaultValue={division.name}
                      required
                      className="rounded-lg border border-neutral-300 px-2 py-1"
                    />
                    <select
                      name="sport"
                      defaultValue={division.sport}
                      className="rounded-lg border border-neutral-300 px-2 py-1"
                    >
                      <option value="hockey_linea">Hockey en línea</option>
                      <option value="hockey_hielo">Hockey en hielo</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-blue px-3 py-1 text-white hover:bg-brand-blue-hover"
                    >
                      Guardar
                    </button>
                    <a href="/dashboard/admin/divisions" className="text-neutral-500 hover:underline">
                      Cancelar
                    </a>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={division.id} className="border-b border-neutral-100">
                <td className="py-2">{division.name}</td>
                <td className="py-2">{SPORT_LABELS[division.sport] ?? division.sport}</td>
                <td className="py-2 text-right">
                  <a
                    href={`/dashboard/admin/divisions?edit=${division.id}`}
                    className="mr-3 text-brand-blue hover:underline"
                  >
                    Editar
                  </a>
                  <form action={deleteDivision} className="inline">
                    <input type="hidden" name="id" value={division.id} />
                    <button type="submit" className="text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            )
          )}
          {(divisions ?? []).length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-neutral-500">
                No hay divisiones todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">
        Crear nueva división
      </h2>
      <form action={createDivision} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Ej. U12"
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="sport">
            Deporte
          </label>
          <select
            id="sport"
            name="sport"
            required
            defaultValue="hockey_linea"
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="hockey_linea">Hockey en línea</option>
            <option value="hockey_hielo">Hockey en hielo</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Crear
        </button>
      </form>
    </div>
  );
}
