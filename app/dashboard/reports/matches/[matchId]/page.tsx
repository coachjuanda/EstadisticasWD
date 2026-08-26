import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadMatchBoxScore } from '@/lib/reports/matchBoxScore';
import { StatsTables } from '../../StatsTables';

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

export default async function MatchBoxScorePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createClient();

  const result = await loadMatchBoxScore(supabase, matchId);
  if (!result.ok) redirect('/dashboard?error=unauthorized');
  const match = result.data;

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Box score</h1>
        <div className="flex gap-2">
          <a
            href={`/api/reports/matches/${matchId}/pdf`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Descargar PDF
          </a>
          <a
            href={`/api/reports/matches/${matchId}/excel`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Descargar Excel
          </a>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex-1 text-center text-lg font-semibold text-neutral-900">{match.homeTeamName}</p>
          <p className="px-4 text-4xl font-bold tabular-nums text-neutral-900">
            {match.homeScore} - {match.awayScore}
          </p>
          <p className="flex-1 text-center text-lg font-semibold text-neutral-900">{match.awayTeamName}</p>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-neutral-500">
          <span>{match.tournamentName}</span>
          <span>·</span>
          <span>
            {new Date(match.scheduledAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
          {match.location && (
            <>
              <span>·</span>
              <span>{match.location}</span>
            </>
          )}
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
            {STATUS_LABELS[match.status] ?? match.status}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <StatsTables
          teamName={match.homeTeamName}
          fieldPlayers={match.fieldPlayers}
          goalies={match.goalies}
          teamStats={match.teamStats}
          statDefs={match.statDefs}
        />
      </div>

      <Link href="/dashboard" className="mt-6 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
