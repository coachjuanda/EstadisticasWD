import { createClient } from '@/lib/supabase/server';
import { createTournament, updateTournament, deleteTournament } from './actions';

type League = { id: string; name: string };
type Division = { id: string; name: string };
type StatDefinition = {
  id: string;
  key: string;
  label: string;
  applies_to: string | null;
  sport: string | null;
  scope: 'jugador' | 'equipo';
  sort_order: number | null;
};
type TournamentRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  league_id: string;
  leagues: { name: string } | null;
  tournament_divisions: { division_id: string; divisions: { name: string } | null }[];
  tournament_stat_config: { stat_definition_id: string }[];
};

// applies_to/sport ya no distinguen el agrupamiento principal (eso lo hace
// scope, desde que PP/PK/offsides/icings/2-1/3-2 se reclasificaron como
// estadísticas de equipo) -- sport queda solo como referencia informativa
// dentro de cada grupo.
const STAT_GROUPS: { label: string; filter: (s: StatDefinition) => boolean }[] = [
  { label: 'Jugadores de campo', filter: (s) => s.scope === 'jugador' && s.applies_to === 'jugador_de_campo' },
  { label: 'Porteros', filter: (s) => s.scope === 'jugador' && s.applies_to === 'portero' },
  { label: 'Equipo', filter: (s) => s.scope === 'equipo' },
];

const bySortOrder = (a: StatDefinition, b: StatDefinition) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

function TournamentFormFields({
  idPrefix,
  leagues,
  divisions,
  statDefinitions,
  defaults,
}: {
  idPrefix: string;
  leagues: League[];
  divisions: Division[];
  statDefinitions: StatDefinition[];
  defaults?: {
    name: string;
    league_id: string;
    start_date: string;
    end_date: string;
    divisionIds: Set<string>;
    statIds: Set<string>;
  };
}) {
  // Sin defaults (formulario de creación): divisiones arrancan sin marcar,
  // estadísticas arrancan todas marcadas -- el admin "desactiva" las que no
  // aplican, en vez de tener que prender cada una desde cero.
  const checkedDivisions = defaults?.divisionIds ?? new Set<string>();
  const checkedStats = defaults?.statIds ?? new Set(statDefinitions.map((s) => s.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor={`${idPrefix}-name`}>
            Nombre
          </label>
          <input
            id={`${idPrefix}-name`}
            name="name"
            required
            defaultValue={defaults?.name}
            placeholder="Ej. Copa Wild Dogs 2026"
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor={`${idPrefix}-league`}>
            Liga
          </label>
          <select
            id={`${idPrefix}-league`}
            name="league_id"
            required
            defaultValue={defaults?.league_id}
            disabled={leagues.length === 0}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor={`${idPrefix}-start`}>
            Fecha inicio
          </label>
          <input
            id={`${idPrefix}-start`}
            name="start_date"
            type="date"
            required
            defaultValue={defaults?.start_date}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor={`${idPrefix}-end`}>
            Fecha fin
          </label>
          <input
            id={`${idPrefix}-end`}
            name="end_date"
            type="date"
            required
            defaultValue={defaults?.end_date}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-neutral-500">
          Divisiones que participan
        </p>
        <div className="mt-1 flex flex-wrap gap-3">
          {divisions.map((d) => (
            <label key={d.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="division_ids"
                value={d.id}
                defaultChecked={checkedDivisions.has(d.id)}
              />
              {d.name}
            </label>
          ))}
          {divisions.length === 0 && (
            <p className="text-sm text-neutral-500">No hay divisiones creadas.</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-neutral-500">
          Estadísticas que se capturan en este torneo
        </p>
        <div className="mt-1 flex flex-col gap-3">
          {STAT_GROUPS.map((group) => {
            const items = statDefinitions.filter(group.filter).sort(bySortOrder);
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="text-xs text-neutral-400">{group.label}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {items.map((s) => (
                    <label key={s.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="stat_definition_ids"
                        value={s.id}
                        defaultChecked={checkedStats.has(s.id)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const { error, edit } = await searchParams;
  const supabase = await createClient();

  const [{ data: leagues }, { data: divisions }, { data: statDefinitions }, { data: tournaments }] =
    await Promise.all([
      supabase.from('leagues').select('id, name').order('name'),
      supabase.from('divisions').select('id, name').order('name'),
      supabase.from('stat_definitions').select('id, key, label, applies_to, sport, scope, sort_order'),
      supabase
        .from('tournaments')
        .select(
          'id, name, start_date, end_date, league_id, leagues(name), tournament_divisions(division_id, divisions(name)), tournament_stat_config(stat_definition_id)'
        )
        .order('start_date', { ascending: false })
        .returns<TournamentRow[]>(),
    ]);

  const leagueList = leagues ?? [];
  const divisionList = divisions ?? [];
  const statList = statDefinitions ?? [];
  const tournamentList = tournaments ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-neutral-900">Torneos</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {leagueList.length === 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Todavía no hay ligas creadas.{' '}
          <a href="/dashboard/admin/leagues" className="underline">
            Crea una primero
          </a>
          .
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {tournamentList.map((t) =>
          edit === t.id ? (
            <div
              key={t.id}
              className="rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4"
            >
              <form action={updateTournament} className="flex flex-col gap-4">
                <input type="hidden" name="id" value={t.id} />
                <TournamentFormFields
                  idPrefix={`edit-${t.id}`}
                  leagues={leagueList}
                  divisions={divisionList}
                  statDefinitions={statList}
                  defaults={{
                    name: t.name,
                    league_id: t.league_id,
                    start_date: t.start_date,
                    end_date: t.end_date,
                    divisionIds: new Set(t.tournament_divisions.map((td) => td.division_id)),
                    statIds: new Set(t.tournament_stat_config.map((tsc) => tsc.stat_definition_id)),
                  }}
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
                  >
                    Guardar
                  </button>
                  <a
                    href="/dashboard/admin/tournaments"
                    className="text-sm text-neutral-500 hover:underline"
                  >
                    Cancelar
                  </a>
                </div>
              </form>
            </div>
          ) : (
            <div
              key={t.id}
              className="flex items-start justify-between rounded-xl border border-neutral-200 p-4"
            >
              <div>
                <p className="font-medium text-neutral-900">{t.name}</p>
                <p className="text-sm text-neutral-500">
                  {t.leagues?.name ?? '—'} · {t.start_date} a {t.end_date}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Divisiones:{' '}
                  {t.tournament_divisions.map((td) => td.divisions?.name).filter(Boolean).join(', ') ||
                    '—'}
                </p>
                <p className="text-sm text-neutral-500">
                  {t.tournament_stat_config.length} estadísticas configuradas
                </p>
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                <a
                  href={`/dashboard/admin/tournaments?edit=${t.id}`}
                  className="text-brand-blue hover:underline"
                >
                  Editar
                </a>
                <form action={deleteTournament}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="text-red-600 hover:underline">
                    Eliminar
                  </button>
                </form>
              </div>
            </div>
          )
        )}
        {tournamentList.length === 0 && (
          <p className="text-sm text-neutral-500">No hay torneos todavía.</p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">
        Crear nuevo torneo
      </h2>
      <form action={createTournament} className="mt-3 rounded-xl border border-neutral-200 p-4">
        <TournamentFormFields
          idPrefix="create"
          leagues={leagueList}
          divisions={divisionList}
          statDefinitions={statList}
        />
        <button
          type="submit"
          disabled={leagueList.length === 0}
          className="mt-4 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
        >
          Crear torneo
        </button>
      </form>
    </div>
  );
}
