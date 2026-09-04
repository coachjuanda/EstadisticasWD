import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { groupMatchesByTournament, indexOfMostRecentGroup } from '@/lib/matches/groupByTournament';
import { TournamentGroupAccordion } from '../../TournamentGroupAccordion';

type MatchInfo = {
  id: string;
  scheduled_at: string;
  location: string | null;
  away_team_name: string;
  status: string;
  tournament_id: string;
  teams: { name: string } | null;
  tournaments: { name: string } | null;
};

type StatsRow = { match_id: string; matches: MatchInfo | null };
type RosterTeamRow = { rosters: { team_id: string } | null };
type UpcomingMatchRow = MatchInfo;

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

function MatchCard({ m }: { m: MatchInfo }) {
  return (
    <a
      key={m.id}
      href={`/dashboard/reports/matches/${m.id}`}
      className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 hover:border-brand-blue"
    >
      <div>
        <p className="font-medium text-neutral-900">
          {m.teams?.name ?? '—'} vs {m.away_team_name}
        </p>
        <p className="text-sm text-neutral-500">
          {new Date(m.scheduled_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          {m.location ? ` · ${m.location}` : ''}
        </p>
      </div>
      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
        {STATUS_LABELS[m.status] ?? m.status}
      </span>
    </a>
  );
}

export default async function AthleteMatchesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "Próximos" sale de matches directo (vía los equipos del deportista, por
  // roster_players -> rosters) -- NO de match_player_stats, que recién se
  // puebla cuando un partido pasa a en_vivo (trg_populate_match_player_stats_
  // on_live). Un partido "programado" nunca tiene filas ahí todavía, así que
  // consultar solo por esa tabla dejaba afuera cualquier partido futuro.
  const { data: rosterTeams } = await supabase
    .from('roster_players')
    .select('rosters(team_id)')
    .eq('athlete_id', user!.id)
    .returns<RosterTeamRow[]>();

  const teamIds = [...new Set((rosterTeams ?? []).map((r) => r.rosters?.team_id).filter((id): id is string => !!id))];

  const [{ data: upcomingRows }, { data: playedRows }] = await Promise.all([
    teamIds.length > 0
      ? supabase
          .from('matches')
          .select('id, scheduled_at, location, away_team_name, status, tournament_id, teams(name), tournaments(name)')
          .in('home_team_id', teamIds)
          .eq('status', 'programado')
          .order('scheduled_at', { ascending: true })
          .returns<UpcomingMatchRow[]>()
      : Promise.resolve({ data: [] as UpcomingMatchRow[] }),
    // "Jugados" -- historial real de partidos donde participó (no solo los
    // que jugó su equipo): se queda con match_player_stats + participated,
    // igual que antes.
    supabase
      .from('match_player_stats')
      .select(
        'match_id, matches(id, scheduled_at, location, away_team_name, status, tournament_id, teams(name), tournaments(name))'
      )
      .eq('athlete_id', user!.id)
      .eq('participated', true)
      .returns<StatsRow[]>(),
  ]);

  const upcomingList = upcomingRows ?? [];

  const playedList = (playedRows ?? [])
    .map((r) => r.matches)
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  const upcomingGroups = groupMatchesByTournament(upcomingList);
  const upcomingDefaultOpenIdx = indexOfMostRecentGroup(upcomingGroups);

  const playedGroups = groupMatchesByTournament(playedList);
  const playedDefaultOpenIdx = indexOfMostRecentGroup(playedGroups);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Mis partidos</h1>

      <h2 className="mt-6 text-sm font-semibold text-neutral-700">Próximos</h2>
      <div className="mt-2 flex flex-col gap-3">
        {upcomingGroups.map((group, idx) => (
          <TournamentGroupAccordion
            key={group.tournamentId}
            name={group.tournamentName}
            matchCount={group.matches.length}
            defaultOpen={idx === upcomingDefaultOpenIdx}
          >
            {group.matches.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </TournamentGroupAccordion>
        ))}
        {upcomingList.length === 0 && (
          <p className="text-sm text-neutral-500">No tienes partidos programados por ahora.</p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">Jugados</h2>
      <div className="mt-2 flex flex-col gap-3">
        {playedGroups.map((group, idx) => (
          <TournamentGroupAccordion
            key={group.tournamentId}
            name={group.tournamentName}
            matchCount={group.matches.length}
            defaultOpen={idx === playedDefaultOpenIdx}
          >
            {group.matches.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </TournamentGroupAccordion>
        ))}
        {playedList.length === 0 && (
          <p className="text-sm text-neutral-500">Todavía no tienes partidos jugados.</p>
        )}
      </div>

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
