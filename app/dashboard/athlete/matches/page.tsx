import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type StatsRow = {
  match_id: string;
  matches: {
    id: string;
    scheduled_at: string;
    away_team_name: string;
    status: string;
    teams: { name: string } | null;
    tournaments: { name: string } | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

export default async function AthleteMatchesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from('match_player_stats')
    .select('match_id, matches(id, scheduled_at, away_team_name, status, teams(name), tournaments(name))')
    .eq('athlete_id', user!.id)
    .returns<StatsRow[]>();

  const matchList = (rows ?? [])
    .map((r) => r.matches)
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Mis partidos</h1>

      <div className="mt-6 flex flex-col gap-3">
        {matchList.map((m) => (
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
                {' · '}
                {m.tournaments?.name ?? '—'}
              </p>
            </div>
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
              {STATUS_LABELS[m.status] ?? m.status}
            </span>
          </a>
        ))}
        {matchList.length === 0 && (
          <p className="text-sm text-neutral-500">Todavía no tienes partidos jugados.</p>
        )}
      </div>

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
