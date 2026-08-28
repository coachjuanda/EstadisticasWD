import { createClient } from '@/lib/supabase/server';
import { groupMatchesByTournament, indexOfMostRecentGroup } from '@/lib/matches/groupByTournament';
import { TournamentGroupAccordion } from '../../TournamentGroupAccordion';
import { createMatch, updateMatch, deleteMatch } from './actions';
import { TeamTournamentSelect } from './TeamTournamentSelect';
import { ForceDeleteMatchButton } from './ForceDeleteMatchButton';

type Tournament = { id: string; name: string };
type TeamOption = { id: string; name: string };
type RosterRow = { tournament_id: string; team_id: string; teams: { name: string } | null };
type Scorekeeper = { id: string; full_name: string };
type MatchRow = {
  id: string;
  scheduled_at: string;
  location: string | null;
  away_team_name: string;
  status: string;
  home_team_id: string;
  tournament_id: string;
  scorekeeper_id: string | null;
  teams: { name: string } | null;
  tournaments: { name: string } | null;
  scorekeeper: { full_name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

function toDatetimeLocalValue(iso: string) {
  return iso.slice(0, 16);
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    edit?: string;
    tournament_id?: string;
    status?: string;
    team_id?: string;
    date_from?: string;
    date_to?: string;
  }>;
}) {
  const {
    error,
    edit,
    tournament_id: tournamentFilter,
    status: statusFilter,
    team_id: teamFilter,
    date_from: dateFromFilter,
    date_to: dateToFilter,
  } = await searchParams;
  const supabase = await createClient();

  const [{ data: tournaments }, { data: allTeams }, { data: rosters }, { data: scorekeepers }] = await Promise.all([
    supabase.from('tournaments').select('id, name').order('name').returns<Tournament[]>(),
    supabase.from('teams').select('id, name').order('name').returns<TeamOption[]>(),
    supabase.from('rosters').select('tournament_id, team_id, teams(name)').returns<RosterRow[]>(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'scorekeeper')
      .eq('status', 'activo')
      .order('full_name')
      .returns<Scorekeeper[]>(),
  ]);

  const tournamentList = tournaments ?? [];
  const teamList = allTeams ?? [];
  const scorekeeperList = scorekeepers ?? [];

  const rostersByTournament: Record<string, TeamOption[]> = {};
  for (const r of rosters ?? []) {
    if (!r.teams) continue;
    if (!rostersByTournament[r.tournament_id]) rostersByTournament[r.tournament_id] = [];
    rostersByTournament[r.tournament_id].push({ id: r.team_id, name: r.teams.name });
  }

  let matchesQuery = supabase
    .from('matches')
    .select(
      'id, scheduled_at, location, away_team_name, status, home_team_id, tournament_id, scorekeeper_id, teams(name), tournaments(name), scorekeeper:profiles!scorekeeper_id(full_name)'
    )
    .order('scheduled_at', { ascending: false });

  if (tournamentFilter) matchesQuery = matchesQuery.eq('tournament_id', tournamentFilter);
  if (statusFilter) matchesQuery = matchesQuery.eq('status', statusFilter);
  if (teamFilter) matchesQuery = matchesQuery.eq('home_team_id', teamFilter);
  if (dateFromFilter) matchesQuery = matchesQuery.gte('scheduled_at', `${dateFromFilter}T00:00:00`);
  if (dateToFilter) matchesQuery = matchesQuery.lte('scheduled_at', `${dateToFilter}T23:59:59`);

  const { data: matches } = await matchesQuery.returns<MatchRow[]>();
  const matchList = matches ?? [];
  const tournamentGroups = groupMatchesByTournament(matchList);
  const defaultOpenIdx = indexOfMostRecentGroup(tournamentGroups);
  // Si se está editando un partido de un torneo colapsado por default, ese
  // grupo debe abrirse igual -- si no, el formulario de edición quedaría
  // escondido detrás de un acordeón cerrado.
  const editingTournamentId = edit ? tournamentGroups.find((g) => g.matches.some((m) => m.id === edit))?.tournamentId : undefined;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Partidos</h1>
        <a
          href="/dashboard/admin/matches/bulk"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
        >
          Carga masiva
        </a>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-tournament">
            Torneo
          </label>
          <select
            id="filter-tournament"
            name="tournament_id"
            defaultValue={tournamentFilter ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            {tournamentList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-status">
            Estado
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={statusFilter ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            <option value="programado">Programado</option>
            <option value="en_vivo">En vivo</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-team">
            Equipo
          </label>
          <select
            id="filter-team"
            name="team_id"
            defaultValue={teamFilter ?? ''}
            className="max-w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            {teamList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-date-from">
            Desde
          </label>
          <input
            id="filter-date-from"
            type="date"
            name="date_from"
            defaultValue={dateFromFilter ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-date-to">
            Hasta
          </label>
          <input
            id="filter-date-to"
            type="date"
            name="date_to"
            defaultValue={dateToFilter ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Filtrar
        </button>
        {(tournamentFilter || statusFilter || teamFilter || dateFromFilter || dateToFilter) && (
          <a href="/dashboard/admin/matches" className="text-sm text-neutral-500 hover:underline">
            Limpiar
          </a>
        )}
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {tournamentGroups.map((group, idx) => (
          <TournamentGroupAccordion
            key={group.tournamentId}
            name={group.tournamentName}
            matchCount={group.matches.length}
            defaultOpen={idx === defaultOpenIdx || group.tournamentId === editingTournamentId}
          >
            {group.matches.map((m) =>
                edit === m.id ? (
                  <div
                    key={m.id}
                    className="rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4"
                  >
                    <form action={updateMatch} className="flex flex-col gap-3">
                      <input type="hidden" name="id" value={m.id} />
                      <div className="flex flex-wrap gap-3">
                        {m.status === 'programado' ? (
                          <TeamTournamentSelect
                            idPrefix={`edit-${m.id}`}
                            tournaments={tournamentList}
                            rostersByTournament={rostersByTournament}
                            defaultTournamentId={m.tournament_id}
                            defaultTeamId={m.home_team_id}
                            defaultTeamName={m.teams?.name}
                          />
                        ) : (
                          <>
                            <input type="hidden" name="tournament_id" value={m.tournament_id} />
                            <input type="hidden" name="home_team_id" value={m.home_team_id} />
                            <p className="text-sm text-neutral-500">
                              {m.tournaments?.name} · {m.teams?.name} (no editable: el partido ya{' '}
                              {m.status === 'en_vivo' ? 'está en vivo' : 'finalizó'})
                            </p>
                          </>
                        )}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-neutral-500">Rival</label>
                          <input
                            name="away_team_name"
                            defaultValue={m.away_team_name}
                            required
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-neutral-500">Fecha y hora</label>
                          <input
                            name="scheduled_at"
                            type="datetime-local"
                            defaultValue={toDatetimeLocalValue(m.scheduled_at)}
                            required
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-neutral-500">Cancha / ubicación</label>
                          <input
                            name="location"
                            defaultValue={m.location ?? ''}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-neutral-500">Scorekeeper</label>
                          <select
                            name="scorekeeper_id"
                            defaultValue={m.scorekeeper_id ?? ''}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                          >
                            <option value="">Sin asignar</option>
                            {scorekeeperList.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.full_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
                        >
                          Guardar
                        </button>
                        <a href="/dashboard/admin/matches" className="text-sm text-neutral-500 hover:underline">
                          Cancelar
                        </a>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 p-4"
                  >
                    <div>
                      <p className="font-medium text-neutral-900">
                        {m.teams?.name ?? '—'} vs {m.away_team_name}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {new Date(m.scheduled_at).toLocaleString('es-CO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}{' '}
                        · {m.location || 'sin cancha definida'}
                      </p>
                      <p className="text-sm text-neutral-500">
                        Scorekeeper: {m.scorekeeper?.full_name ?? 'sin asignar'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 text-sm">
                      <span
                        className={
                          m.status === 'programado'
                            ? 'rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600'
                            : m.status === 'en_vivo'
                              ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700'
                              : 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                        }
                      >
                        {STATUS_LABELS[m.status] ?? m.status}
                      </span>
                      <div className="flex flex-wrap justify-end gap-3">
                        {m.status !== 'programado' && (
                          <a href={`/dashboard/reports/matches/${m.id}`} className="text-brand-blue hover:underline">
                            Box score
                          </a>
                        )}
                        <a
                          href={`/dashboard/admin/matches?edit=${m.id}`}
                          className="text-brand-blue hover:underline"
                        >
                          Editar
                        </a>
                        {m.status === 'programado' && (
                          <form action={deleteMatch}>
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="text-red-600 hover:underline">
                              Eliminar
                            </button>
                          </form>
                        )}
                      </div>
                      {m.status !== 'programado' && (
                        <ForceDeleteMatchButton matchId={m.id} awayTeamName={m.away_team_name} />
                      )}
                    </div>
                  </div>
                )
              )}
          </TournamentGroupAccordion>
        ))}
        {matchList.length === 0 && (
          <p className="text-sm text-neutral-500">No hay partidos con ese filtro.</p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">
        Programar nuevo partido
      </h2>
      {tournamentList.length === 0 ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Todavía no hay torneos creados.{' '}
          <a href="/dashboard/admin/tournaments" className="underline">
            Crea uno primero
          </a>
          .
        </p>
      ) : (
        <form
          action={createMatch}
          className="mt-3 flex flex-col gap-3 rounded-xl border border-neutral-200 p-4"
        >
          <div className="flex flex-wrap gap-3">
            <TeamTournamentSelect
              idPrefix="create"
              tournaments={tournamentList}
              rostersByTournament={rostersByTournament}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500" htmlFor="create-away">
                Rival
              </label>
              <input
                id="create-away"
                name="away_team_name"
                required
                placeholder="Ej. Ararat HC"
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500" htmlFor="create-scheduled">
                Fecha y hora
              </label>
              <input
                id="create-scheduled"
                name="scheduled_at"
                type="datetime-local"
                required
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500" htmlFor="create-location">
                Cancha / ubicación
              </label>
              <input
                id="create-location"
                name="location"
                placeholder="Ej. Coliseo Wild Dogs"
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500" htmlFor="create-scorekeeper">
                Scorekeeper
              </label>
              <select
                id="create-scorekeeper"
                name="scorekeeper_id"
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
              >
                <option value="">Sin asignar</option>
                {scorekeeperList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="w-fit rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
          >
            Programar partido
          </button>
        </form>
      )}
    </div>
  );
}
