import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type MatchRow = {
  id: string;
  scheduled_at: string;
  location: string | null;
  away_team_name: string;
  status: string;
  teams: { name: string } | null;
  tournaments: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

export default async function ScorekeeperHomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matches } = await supabase
    .from('matches')
    .select('id, scheduled_at, location, away_team_name, status, teams(name), tournaments(name)')
    .eq('scorekeeper_id', user!.id)
    .order('scheduled_at', { ascending: true })
    .returns<MatchRow[]>();

  const matchList = matches ?? [];

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Mis partidos</h1>

      <div className="mt-6 flex flex-col gap-3">
        {matchList.map((m) => (
          <a
            key={m.id}
            href={`/dashboard/scorekeeper/${m.id}`}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 hover:border-brand-blue"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {m.teams?.name ?? '—'} vs {m.away_team_name}
              </p>
              <p className="text-sm text-neutral-500">
                {new Date(m.scheduled_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                {' · '}
                {m.location || 'sin cancha definida'} · {m.tournaments?.name ?? '—'}
              </p>
            </div>
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
          </a>
        ))}
        {matchList.length === 0 && (
          <p className="text-sm text-neutral-500">
            No tienes partidos asignados todavía.
          </p>
        )}
      </div>

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
