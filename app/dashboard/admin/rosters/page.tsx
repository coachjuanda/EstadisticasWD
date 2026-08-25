import { createClient } from '@/lib/supabase/server';
import { createRoster, deleteRoster, addRosterPlayer, removeRosterPlayer } from './actions';

type TeamOption = { id: string; name: string; divisions: { name: string } | null };
type TournamentOption = { id: string; name: string };
type RosterRow = {
  id: string;
  team_id: string;
  tournament_id: string;
  teams: { name: string } | null;
  tournaments: { name: string } | null;
  roster_players: { id: string }[];
};
type RosterPlayerRow = {
  id: string;
  jersey_number: number | null;
  athlete_id: string;
  athlete_profiles: { full_name: string; position: string | null } | null;
};
type AthleteOption = { id: string; full_name: string; cedula: string };

const POSITION_LABELS: Record<string, string> = {
  jugador_de_campo: 'Jugador de campo',
  portero: 'Portero',
};

export default async function RostersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; roster?: string }>;
}) {
  const { error, roster: rosterId } = await searchParams;
  const supabase = await createClient();

  const [{ data: teams }, { data: tournaments }, { data: rosters }] = await Promise.all([
    supabase.from('teams').select('id, name, divisions(name)').order('name').returns<TeamOption[]>(),
    supabase.from('tournaments').select('id, name').order('name').returns<TournamentOption[]>(),
    supabase
      .from('rosters')
      .select('id, team_id, tournament_id, teams(name), tournaments(name), roster_players(id)')
      .returns<RosterRow[]>(),
  ]);

  const teamList = teams ?? [];
  const tournamentList = tournaments ?? [];
  const rosterList = rosters ?? [];

  if (rosterId) {
    const roster = rosterList.find((r) => r.id === rosterId);

    const [{ data: rosterPlayers }, { data: athletes }] = await Promise.all([
      supabase
        .from('roster_players')
        .select('id, jersey_number, athlete_id, athlete_profiles(full_name, position)')
        .eq('roster_id', rosterId)
        .order('jersey_number')
        .returns<RosterPlayerRow[]>(),
      supabase
        .from('profiles')
        .select('id, full_name, cedula')
        .eq('role', 'deportista')
        .order('full_name')
        .returns<AthleteOption[]>(),
    ]);

    const playerList = rosterPlayers ?? [];
    const alreadyInRoster = new Set(playerList.map((p) => p.athlete_id));
    const availableAthletes = (athletes ?? []).filter((a) => !alreadyInRoster.has(a.id));

    return (
      <div className="mx-auto max-w-2xl">
        <a href="/dashboard/admin/rosters" className="text-sm text-neutral-500 hover:underline">
          ← Volver a nóminas
        </a>

        <h1 className="mt-2 text-xl font-semibold text-neutral-900">
          {roster?.teams?.name ?? '—'} · {roster?.tournaments?.name ?? '—'}
        </h1>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 font-medium">#</th>
              <th className="py-2 font-medium">Deportista</th>
              <th className="py-2 font-medium">Posición</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {playerList.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="py-2">{p.jersey_number ?? '—'}</td>
                <td className="py-2">{p.athlete_profiles?.full_name ?? '—'}</td>
                <td className="py-2">
                  {p.athlete_profiles?.position ? (
                    <span
                      className={
                        p.athlete_profiles.position === 'portero'
                          ? 'rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700'
                          : 'rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600'
                      }
                    >
                      {POSITION_LABELS[p.athlete_profiles.position] ?? p.athlete_profiles.position}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 text-right">
                  <form action={removeRosterPlayer} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="roster_id" value={rosterId} />
                    <button type="submit" className="text-red-600 hover:underline">
                      Quitar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {playerList.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-neutral-500">
                  Todavía no hay deportistas en esta nómina.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h2 className="mt-8 text-sm font-semibold text-neutral-700">
          Agregar deportista
        </h2>
        <form action={addRosterPlayer} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="roster_id" value={rosterId} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="athlete_id">
              Deportista
            </label>
            <select
              id="athlete_id"
              name="athlete_id"
              required
              disabled={availableAthletes.length === 0}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            >
              {availableAthletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name} ({a.cedula})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="jersey_number">
              Número
            </label>
            <input
              id="jersey_number"
              name="jersey_number"
              type="number"
              min={0}
              className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={availableAthletes.length === 0}
            className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
        {availableAthletes.length === 0 && (athletes ?? []).length > 0 && (
          <p className="mt-2 text-sm text-neutral-500">
            Todos los deportistas del club ya están en esta nómina.
          </p>
        )}
        {(athletes ?? []).length === 0 && (
          <p className="mt-2 text-sm text-neutral-500">
            No hay deportistas creados todavía en{' '}
            <a href="/dashboard/admin/users" className="underline">
              Usuarios
            </a>
            .
          </p>
        )}

        <form action={deleteRoster} className="mt-8">
          <input type="hidden" name="id" value={rosterId} />
          <button type="submit" className="text-sm text-red-600 hover:underline">
            Eliminar esta nómina completa
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-neutral-900">Nóminas</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {rosterList.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-neutral-200 p-4"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {r.teams?.name ?? '—'} · {r.tournaments?.name ?? '—'}
              </p>
              <p className="text-sm text-neutral-500">
                {r.roster_players.length} deportista(s)
              </p>
            </div>
            <div className="flex shrink-0 gap-3 text-sm">
              <a
                href={`/dashboard/team-stats/${r.team_id}?tournament_id=${r.tournament_id}`}
                className="text-brand-blue hover:underline"
              >
                Ver estadísticas
              </a>
              <a href={`/dashboard/admin/rosters?roster=${r.id}`} className="text-brand-blue hover:underline">
                Ver nómina
              </a>
            </div>
          </div>
        ))}
        {rosterList.length === 0 && (
          <p className="text-sm text-neutral-500">No hay nóminas todavía.</p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">
        Crear nueva nómina
      </h2>
      <form action={createRoster} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="team_id">
            Equipo
          </label>
          <select
            id="team_id"
            name="team_id"
            required
            disabled={teamList.length === 0}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            {teamList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.divisions?.name ? ` (${t.divisions.name})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="tournament_id">
            Torneo
          </label>
          <select
            id="tournament_id"
            name="tournament_id"
            required
            disabled={tournamentList.length === 0}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            {tournamentList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={teamList.length === 0 || tournamentList.length === 0}
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
        >
          Crear nómina
        </button>
      </form>
    </div>
  );
}
