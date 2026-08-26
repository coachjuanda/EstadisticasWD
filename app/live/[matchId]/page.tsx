import Image from 'next/image';
import { createPublicClient } from '@/lib/supabase/public';
import { AutoRefresh } from './AutoRefresh';

type MatchSummary = {
  match_id: string;
  status: string;
  scheduled_at: string;
  location: string | null;
  away_team_name: string;
  home_team_id: string;
  home_team_name: string;
  tournament_name: string;
  tournament_id: string;
};

type PlayerStat = {
  athlete_id: string;
  athlete_full_name: string;
  jersey_number: number | null;
  stats: Record<string, number>;
};

type StatColumn = {
  key: string;
  label: string;
  scope: 'jugador' | 'equipo';
  applies_to: string | null;
  sort_order: number | null;
};

export default async function PublicLiveMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = createPublicClient();

  const { data: match } = await supabase
    .from('public_match_summary')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle<MatchSummary>();

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <p className="text-center text-neutral-500">
          Este partido no está disponible todavía (aún no comienza o no existe).
        </p>
      </main>
    );
  }

  const [{ data: players }, { data: statColumns }] = await Promise.all([
    supabase
      .from('public_match_player_stats')
      .select('athlete_id, athlete_full_name, jersey_number, stats')
      .eq('match_id', matchId)
      .returns<PlayerStat[]>(),
    supabase
      .from('public_tournament_stat_config')
      .select('key, label, scope, applies_to, sort_order')
      .eq('tournament_id', match.tournament_id)
      .returns<StatColumn[]>(),
  ]);

  const playerList = (players ?? []).sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
  // Una sola tabla mezclando jugadores de campo y porteros -- las
  // estadísticas de equipo (PP, offsides, etc.) no tienen sentido como
  // columna de un jugador individual, así que se excluyen (siguen contando
  // para el marcador vía goals/goals_received). Se limita además a jugador
  // de campo: shots_received/goals_received de portero tienen su propio
  // sort_order empezando en 1 (mismo rango que las de campo), así que
  // mezclarlas en la misma tabla rompía el orden -- una vista pública con
  // tabla de porteros separada es un rediseño para otro momento, no de hoy.
  const columns = (statColumns ?? [])
    .filter((c) => c.scope === 'jugador' && c.applies_to === 'jugador_de_campo')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const hasPlusMinus = columns.some((c) => c.key === 'plus') && columns.some((c) => c.key === 'minus');

  const homeScore = playerList.reduce((sum, p) => sum + (p.stats.goals ?? 0), 0);
  const awayScore = playerList.reduce((sum, p) => sum + (p.stats.goals_received ?? 0), 0);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6">
      <AutoRefresh intervalMs={5000} />
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex justify-center">
            <Image src="/logo-wilddogs.png" alt="Wild Dogs" width={40} height={40} priority />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="flex-1 text-center text-base font-semibold text-neutral-900 sm:text-xl">
              {match.home_team_name}
            </p>
            <p className="px-3 text-4xl font-bold tabular-nums text-neutral-900 sm:text-5xl">
              {homeScore} - {awayScore}
            </p>
            <p className="flex-1 text-center text-base font-semibold text-neutral-900 sm:text-xl">
              {match.away_team_name}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-neutral-500">
            <span>{match.tournament_name}</span>
            {match.status === 'finalizado' ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Finalizado
              </span>
            ) : (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                En vivo
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
                <th className="px-3 py-2 font-medium">Jugador</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-center font-medium">
                    {c.label}
                  </th>
                ))}
                {hasPlusMinus && <th className="px-3 py-2 text-center font-medium">+/-</th>}
              </tr>
            </thead>
            <tbody>
              {playerList.map((p) => (
                <tr key={p.athlete_id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-3 py-2 text-neutral-900">
                    #{p.jersey_number ?? '—'} {p.athlete_full_name}
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-center tabular-nums text-neutral-700">
                      {p.stats[c.key] ?? 0}
                    </td>
                  ))}
                  {hasPlusMinus && (
                    <td className="px-3 py-2 text-center tabular-nums text-neutral-700">
                      {(p.stats.plus ?? 0) - (p.stats.minus ?? 0)}
                    </td>
                  )}
                </tr>
              ))}
              {playerList.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1 + (hasPlusMinus ? 1 : 0)}
                    className="px-3 py-4 text-center text-neutral-500"
                  >
                    Sin estadísticas registradas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
