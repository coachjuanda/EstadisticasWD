import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadTeamSummary } from '@/lib/reports/teamSummary';
import { StatsTables } from '../../StatsTables';

export default async function TeamSummaryPage({
  params,
}: {
  params: Promise<{ rosterId: string }>;
}) {
  const { rosterId } = await params;
  const supabase = await createClient();

  const result = await loadTeamSummary(supabase, rosterId);
  if (!result.ok) redirect('/dashboard?error=unauthorized');
  const summary = result.data;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Resumen de equipo</h1>
        <div className="flex gap-2">
          <a
            href={`/api/reports/teams/${rosterId}/pdf`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Descargar PDF
          </a>
          <a
            href={`/api/reports/teams/${rosterId}/excel`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Descargar Excel
          </a>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {summary.teamName}
        {summary.divisionName ? ` (${summary.divisionName})` : ''} · {summary.tournamentName}
        {' · '}
        {summary.matchesConsidered} partido{summary.matchesConsidered === 1 ? '' : 's'} considerado
        {summary.matchesConsidered === 1 ? '' : 's'}
      </p>

      <div className="mt-6">
        <StatsTables
          teamName={summary.teamName}
          fieldPlayers={summary.fieldPlayers}
          goalies={summary.goalies}
          teamStats={summary.teamStats}
          statDefs={summary.statDefs}
        />
      </div>

      <Link href="/dashboard" className="mt-6 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
