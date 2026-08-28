import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { groupMatchesByTournament, indexOfMostRecentGroup } from '@/lib/matches/groupByTournament';
import { TournamentGroupAccordion } from '../../TournamentGroupAccordion';

type MatchRow = {
  id: string;
  scheduled_at: string;
  away_team_name: string;
  status: string;
  tournament_id: string;
  teams: { name: string } | null;
  tournaments: { name: string } | null;
};

type RosterRow = {
  id: string;
  team_id: string;
  tournament_id: string;
  teams: { name: string } | null;
  tournaments: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

export default async function CoachMatchesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: coachTeams } = await supabase.from('coach_teams').select('team_id').eq('coach_id', user!.id);
  const teamIds = (coachTeams ?? []).map((t) => t.team_id);

  const [{ data: matches }, { data: rosters }] =
    teamIds.length > 0
      ? await Promise.all([
          supabase
            .from('matches')
            .select('id, scheduled_at, away_team_name, status, tournament_id, teams(name), tournaments(name)')
            .in('home_team_id', teamIds)
            .order('scheduled_at', { ascending: false })
            .returns<MatchRow[]>(),
          supabase
            .from('rosters')
            .select('id, team_id, tournament_id, teams(name), tournaments(name)')
            .in('team_id', teamIds)
            .returns<RosterRow[]>(),
        ])
      : [{ data: [] as MatchRow[] }, { data: [] as RosterRow[] }];

  const matchList = matches ?? [];
  const rosterList = rosters ?? [];
  const tournamentGroups = groupMatchesByTournament(matchList);
  const defaultOpenIdx = indexOfMostRecentGroup(tournamentGroups);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Mis equipos y partidos</h1>

      <h2 className="mt-6 text-sm font-semibold text-neutral-700">Resumen de equipo por torneo</h2>
      <div className="mt-2 flex flex-col gap-2">
        {rosterList.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3 text-sm"
          >
            <span>
              {r.teams?.name ?? '—'} · {r.tournaments?.name ?? '—'}
            </span>
            <a href={`/dashboard/team-stats/${r.team_id}?tournament_id=${r.tournament_id}`} className="text-brand-blue hover:underline">
              Dashboard →
            </a>
          </div>
        ))}
        {rosterList.length === 0 && <p className="text-sm text-neutral-500">No tienes equipos asignados todavía.</p>}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">Partidos</h2>
      <div className="mt-2 flex flex-col gap-3">
        {tournamentGroups.map((group, idx) => (
          <TournamentGroupAccordion
            key={group.tournamentId}
            name={group.tournamentName}
            matchCount={group.matches.length}
            defaultOpen={idx === defaultOpenIdx}
          >
            {group.matches.map((m) => (
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
                  </p>
                </div>
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
                  {STATUS_LABELS[m.status] ?? m.status}
                </span>
              </a>
            ))}
          </TournamentGroupAccordion>
        ))}
        {matchList.length === 0 && <p className="text-sm text-neutral-500">No hay partidos todavía.</p>}
      </div>

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
