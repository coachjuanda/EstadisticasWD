import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadTeamStats } from '@/lib/team-stats/loadTeamStats';
import { TeamRosterTables } from './TeamRosterTables';
import { TeamStatsChart } from './TeamStatsChart';

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

const RESULT_LABELS: Record<string, string> = {
  win: 'G',
  loss: 'P',
  tie: 'E',
};

export default async function TeamStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tournament_id?: string }>;
}) {
  const { teamId } = await params;
  const { tournament_id: tournamentId } = await searchParams;
  const supabase = await createClient();

  const result = await loadTeamStats(supabase, teamId, tournamentId);
  if (!result.ok) redirect('/dashboard?error=unauthorized');
  const team = result.data;

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            {team.teamName}
            {team.divisionName ? ` (${team.divisionName})` : ''}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Dashboard de estadísticas del equipo</p>
        </div>
        {team.rosterId && (
          <div className="flex gap-2">
            <a
              href={`/api/reports/teams/${team.rosterId}/pdf`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Descargar PDF
            </a>
            <a
              href={`/api/reports/teams/${team.rosterId}/excel`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Descargar Excel
            </a>
          </div>
        )}
      </div>

      {team.tournaments.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">Este equipo todavía no tiene nómina en ningún torneo.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {team.tournaments.map((t) => (
              <a
                key={t.id}
                href={`/dashboard/team-stats/${teamId}?tournament_id=${t.id}`}
                className={
                  t.id === team.selectedTournamentId
                    ? 'rounded-full bg-brand-blue px-3 py-1 font-semibold text-white'
                    : 'rounded-full border border-neutral-300 px-3 py-1 text-neutral-700 hover:bg-neutral-100'
                }
              >
                {t.name}
              </a>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 p-4 text-center">
              <p className="text-xs text-neutral-500">Partidos jugados</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{team.summary.matchesPlayed}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4 text-center">
              <p className="text-xs text-neutral-500">Récord (G-P-E)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
                {team.summary.wins}-{team.summary.losses}-{team.summary.ties}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4 text-center">
              <p className="text-xs text-neutral-500">Goles a favor / en contra</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
                {team.summary.goalsFor} / {team.summary.goalsAgainst}
              </p>
            </div>
            {team.summary.topStats.map((s) => (
              <div key={s.key} className="rounded-xl border border-neutral-200 p-4 text-center">
                <p className="text-xs text-neutral-500">{s.label} (acumulado)</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <TeamRosterTables
              teamName={team.teamName}
              fieldPlayers={team.seasonFieldPlayers}
              goalies={team.seasonGoalies}
              teamStats={team.seasonTeamStats}
              statDefs={team.statDefs}
            />
          </div>

          <h2 className="mt-10 text-sm font-semibold text-neutral-700">Evolución en el tiempo</h2>
          <TeamStatsChart
            matches={team.matches}
            statDefs={team.statDefs}
            viewerRole={team.viewerRole}
            viewerAthleteId={team.viewerAthleteId}
          />

          <h2 className="mt-10 text-sm font-semibold text-neutral-700">Partidos — {team.selectedTournamentName}</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Rival</th>
                  <th className="px-3 py-2 text-center font-medium">Marcador</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {team.matches.map((m) => (
                  <tr key={m.matchId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 text-neutral-700">
                      {new Date(m.scheduledAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-3 py-2 text-neutral-900">{m.awayTeamName}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-neutral-900">
                      {m.played ? (
                        <>
                          {m.homeScore} - {m.awayScore}{' '}
                          <span className="text-xs text-neutral-500">({RESULT_LABELS[m.result ?? 'tie']})</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <a href={`/dashboard/reports/matches/${m.matchId}`} className="text-brand-blue hover:underline">
                        {STATUS_LABELS[m.status] ?? m.status}
                      </a>
                    </td>
                  </tr>
                ))}
                {team.matches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-neutral-500">
                      Sin partidos programados en este torneo todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
