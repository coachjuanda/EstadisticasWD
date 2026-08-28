'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export type PlayerData = {
  matchPlayerStatId: string;
  athleteId: string;
  fullName: string;
  jerseyNumber: number | null;
  position: string | null;
  participated: boolean;
  stats: Record<string, number>;
};

export type StatDef = {
  id: string;
  key: string;
  label: string;
  appliesTo: string | null;
  scope: 'jugador' | 'equipo';
  sortOrder: number | null;
};

export type TeamStatsData = { matchTeamStatId: string; stats: Record<string, number> };

function StatCell({
  value,
  onDecrement,
  onIncrement,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDecrement();
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-base font-bold text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300"
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-bold tabular-nums text-neutral-900">
        {value}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onIncrement();
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-orange text-base font-bold text-white hover:bg-brand-orange-hover active:bg-brand-orange-hover"
      >
        +
      </button>
    </div>
  );
}

export function LiveMatchClient({
  matchId,
  homeTeamName,
  awayTeamName,
  initialPlayers,
  statDefs,
  initialTeamStats,
}: {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  initialPlayers: PlayerData[];
  statDefs: StatDef[];
  initialTeamStats: TeamStatsData | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [players, setPlayers] = useState(initialPlayers);
  const [teamStats, setTeamStats] = useState(initialTeamStats);
  const [finalizing, setFinalizing] = useState(false);

  // Resaltado de fila activa por tabla -- puramente visual, no se persiste.
  // bg-[#e8ecfe] = --color-brand-blue (#1840f0) mezclado 10% sobre blanco,
  // precalculado porque la celda sticky del nombre necesita un fondo opaco
  // (una clase con opacidad dejaría ver las columnas de atrás al hacer scroll).
  const [highlightedFieldPlayer, setHighlightedFieldPlayer] = useState<string | null>(null);
  const [highlightedGoalie, setHighlightedGoalie] = useState<string | null>(null);
  const [teamRowHighlighted, setTeamRowHighlighted] = useState(false);

  const bySortOrder = (a: StatDef, b: StatDef) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  const fieldStatDefs = statDefs
    .filter((s) => s.scope === 'jugador' && s.appliesTo === 'jugador_de_campo')
    .sort(bySortOrder);
  const goalieStatDefs = statDefs.filter((s) => s.scope === 'jugador' && s.appliesTo === 'portero').sort(bySortOrder);
  const teamStatDefs = statDefs.filter((s) => s.scope === 'equipo').sort(bySortOrder);

  const activePlayers = players.filter((p) => p.participated);
  const removedPlayers = players.filter((p) => !p.participated);
  const fieldPlayers = activePlayers.filter((p) => p.position !== 'portero');
  const goalies = activePlayers.filter((p) => p.position === 'portero');

  // "+/-" calculado (Plus - Minus), mismo patrón que SV% y Efectividad PP/PK.
  const hasPlusMinus = fieldStatDefs.some((s) => s.key === 'plus') && fieldStatDefs.some((s) => s.key === 'minus');

  const homeScore = activePlayers.reduce((sum, p) => sum + (p.stats.goals ?? 0), 0);
  const awayScore = activePlayers.reduce((sum, p) => sum + (p.stats.goals_received ?? 0), 0);

  // Efectividad de PP/PK: calculada, no se ingresa -- mismo patrón que SV%.
  const hasPpPair = teamStatDefs.some((s) => s.key === 'pp') && teamStatDefs.some((s) => s.key === 'pp_goal');
  const hasPkPair = teamStatDefs.some((s) => s.key === 'pk') && teamStatDefs.some((s) => s.key === 'pk_goal');
  const ppCount = teamStats?.stats.pp ?? 0;
  const ppGoalCount = teamStats?.stats.pp_goal ?? 0;
  const pkCount = teamStats?.stats.pk ?? 0;
  const pkGoalCount = teamStats?.stats.pk_goal ?? 0;
  const ppEffectiveness = hasPpPair && ppCount > 0 ? Math.round((ppGoalCount / ppCount) * 100) : null;
  const pkEffectiveness = hasPkPair && pkCount > 0 ? Math.round(((pkCount - pkGoalCount) / pkCount) * 100) : null;

  async function handlePlayerTap(matchPlayerStatId: string, statKey: string, delta: number) {
    setPlayers((prev) =>
      prev.map((p) =>
        p.matchPlayerStatId === matchPlayerStatId
          ? { ...p, stats: { ...p.stats, [statKey]: Math.max(0, (p.stats[statKey] ?? 0) + delta) } }
          : p
      )
    );

    const { data } = await supabase.rpc('increment_match_stat', {
      p_match_player_stat_id: matchPlayerStatId,
      p_stat_key: statKey,
      p_delta: delta,
    });

    if (data) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.matchPlayerStatId === matchPlayerStatId ? { ...p, stats: data as Record<string, number> } : p
        )
      );
    }
  }

  async function handleToggleParticipation(matchPlayerStatId: string, participated: boolean) {
    setPlayers((prev) =>
      prev.map((p) => (p.matchPlayerStatId === matchPlayerStatId ? { ...p, participated } : p))
    );

    await supabase.from('match_player_stats').update({ participated }).eq('id', matchPlayerStatId);
  }

  async function handleTeamTap(statKey: string, delta: number) {
    if (!teamStats) return;
    const id = teamStats.matchTeamStatId;

    setTeamStats((prev) =>
      prev ? { ...prev, stats: { ...prev.stats, [statKey]: Math.max(0, (prev.stats[statKey] ?? 0) + delta) } } : prev
    );

    const { data } = await supabase.rpc('increment_match_team_stat', {
      p_match_team_stat_id: id,
      p_stat_key: statKey,
      p_delta: delta,
    });

    if (data) {
      setTeamStats((prev) => (prev ? { ...prev, stats: data as Record<string, number> } : prev));
    }
  }

  async function handleFinalize() {
    if (
      !confirm(
        '¿Finalizar el partido? Después de esto no vas a poder seguir editando las estadísticas.'
      )
    ) {
      return;
    }
    setFinalizing(true);
    await supabase.from('matches').update({ status: 'finalizado' }).eq('id', matchId);
    router.push('/dashboard/scorekeeper');
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex justify-center">
          <Image src="/logo-wilddogs.png" alt="Wild Dogs" width={32} height={32} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="flex-1 text-center text-lg font-semibold text-neutral-900">
            {homeTeamName}
          </p>
          <p className="px-4 text-4xl font-bold tabular-nums text-neutral-900">
            {homeScore} - {awayScore}
          </p>
          <p className="flex-1 text-center text-lg font-semibold text-neutral-900">
            {awayTeamName}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleFinalize}
        disabled={finalizing}
        className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {finalizing ? 'Finalizando...' : 'Finalizar partido'}
      </button>

      <details className="group mt-6 rounded-xl border border-neutral-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <h2 className="text-sm font-semibold text-neutral-700">
            Convocatoria ({activePlayers.length}/{players.length} activos)
          </h2>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </summary>
        <div className="flex flex-col gap-1 px-4 pb-4">
          <p className="mb-1 text-xs text-neutral-500">
            Remueve a un jugador si no participó en este partido (lesión, inasistencia, etc). No
            afecta su nómina del torneo ni otros partidos.
          </p>
          {activePlayers.map((p) => (
            <div
              key={p.matchPlayerStatId}
              className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
            >
              <span className="text-neutral-900">
                #{p.jerseyNumber ?? '—'} {p.fullName}
              </span>
              <button
                type="button"
                onClick={() => handleToggleParticipation(p.matchPlayerStatId, false)}
                className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Remover del partido
              </button>
            </div>
          ))}
          {activePlayers.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-500">Sin jugadores activos en este partido.</p>
          )}
        </div>
      </details>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Jugadores</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-500">
                  Jugador
                </th>
                {fieldStatDefs.map((s) => (
                  <th
                    key={s.id}
                    className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500"
                  >
                    {s.label}
                  </th>
                ))}
                {hasPlusMinus && (
                  <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    +/-
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {fieldPlayers.map((p) => {
                const isHighlighted = highlightedFieldPlayer === p.matchPlayerStatId;
                return (
                <tr
                  key={p.matchPlayerStatId}
                  onClick={() =>
                    setHighlightedFieldPlayer((prev) => (prev === p.matchPlayerStatId ? null : p.matchPlayerStatId))
                  }
                  className={`cursor-pointer border-b border-neutral-100 last:border-0 ${isHighlighted ? 'bg-[#e8ecfe]' : ''}`}
                >
                  <td
                    className={`sticky left-0 z-10 whitespace-nowrap border-r border-neutral-100 px-3 py-2 font-medium text-neutral-900 ${isHighlighted ? 'bg-[#e8ecfe]' : 'bg-white'}`}
                  >
                    #{p.jerseyNumber ?? '—'} {p.fullName}
                  </td>
                  {fieldStatDefs.map((s) => (
                    <td key={s.id} className="px-2 py-1.5">
                      <StatCell
                        value={p.stats[s.key] ?? 0}
                        onDecrement={() => handlePlayerTap(p.matchPlayerStatId, s.key, -1)}
                        onIncrement={() => handlePlayerTap(p.matchPlayerStatId, s.key, 1)}
                      />
                    </td>
                  ))}
                  {hasPlusMinus && (
                    <td className="px-2 py-1.5 text-center tabular-nums text-neutral-700">
                      {(p.stats.plus ?? 0) - (p.stats.minus ?? 0)}
                    </td>
                  )}
                </tr>
                );
              })}
              {fieldPlayers.length === 0 && (
                <tr>
                  <td
                    colSpan={fieldStatDefs.length + 1 + (hasPlusMinus ? 1 : 0)}
                    className="px-3 py-4 text-center text-neutral-500"
                  >
                    Sin jugadores de campo en la nómina.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Porteros</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-500">
                  Portero
                </th>
                {goalieStatDefs.map((s) => (
                  <th
                    key={s.id}
                    className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500"
                  >
                    {s.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                  SV%
                </th>
              </tr>
            </thead>
            <tbody>
              {goalies.map((p) => {
                const shots = p.stats.shots_received ?? 0;
                const goalsAgainst = p.stats.goals_received ?? 0;
                const savePct = shots > 0 ? Math.round(((shots - goalsAgainst) / shots) * 100) : null;
                const isHighlighted = highlightedGoalie === p.matchPlayerStatId;

                return (
                  <tr
                    key={p.matchPlayerStatId}
                    onClick={() =>
                      setHighlightedGoalie((prev) => (prev === p.matchPlayerStatId ? null : p.matchPlayerStatId))
                    }
                    className={`cursor-pointer border-b border-neutral-100 last:border-0 ${isHighlighted ? 'bg-[#e8ecfe]' : ''}`}
                  >
                    <td
                      className={`sticky left-0 z-10 whitespace-nowrap border-r border-neutral-100 px-3 py-2 font-medium text-neutral-900 ${isHighlighted ? 'bg-[#e8ecfe]' : 'bg-white'}`}
                    >
                      #{p.jerseyNumber ?? '—'} {p.fullName}
                    </td>
                    {goalieStatDefs.map((s) => (
                      <td key={s.id} className="px-2 py-1.5">
                        <StatCell
                          value={p.stats[s.key] ?? 0}
                          onDecrement={() => handlePlayerTap(p.matchPlayerStatId, s.key, -1)}
                          onIncrement={() => handlePlayerTap(p.matchPlayerStatId, s.key, 1)}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center tabular-nums text-neutral-700">
                      {savePct !== null ? `${savePct}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              {goalies.length === 0 && (
                <tr>
                  <td colSpan={goalieStatDefs.length + 2} className="px-3 py-4 text-center text-neutral-500">
                    Sin porteros en la nómina.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Estadísticas de equipo</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-500">
                  Equipo
                </th>
                {teamStatDefs.map((s) => (
                  <th
                    key={s.id}
                    className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500"
                  >
                    {s.label}
                  </th>
                ))}
                {hasPpPair && (
                  <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    Efectividad PP
                  </th>
                )}
                {hasPkPair && (
                  <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    Efectividad PK
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {teamStats ? (
                <tr
                  onClick={() => setTeamRowHighlighted((prev) => !prev)}
                  className={`cursor-pointer ${teamRowHighlighted ? 'bg-[#e8ecfe]' : ''}`}
                >
                  <td
                    className={`sticky left-0 z-10 whitespace-nowrap border-r border-neutral-100 px-3 py-2 font-medium text-neutral-900 ${teamRowHighlighted ? 'bg-[#e8ecfe]' : 'bg-white'}`}
                  >
                    {homeTeamName}
                  </td>
                  {teamStatDefs.map((s) => (
                    <td key={s.id} className="px-2 py-1.5">
                      <StatCell
                        value={teamStats.stats[s.key] ?? 0}
                        onDecrement={() => handleTeamTap(s.key, -1)}
                        onIncrement={() => handleTeamTap(s.key, 1)}
                      />
                    </td>
                  ))}
                  {hasPpPair && (
                    <td className="px-2 py-1.5 text-center tabular-nums text-neutral-700">
                      {ppEffectiveness !== null ? `${ppEffectiveness}%` : '—'}
                    </td>
                  )}
                  {hasPkPair && (
                    <td className="px-2 py-1.5 text-center tabular-nums text-neutral-700">
                      {pkEffectiveness !== null ? `${pkEffectiveness}%` : '—'}
                    </td>
                  )}
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={teamStatDefs.length + 1 + (hasPpPair ? 1 : 0) + (hasPkPair ? 1 : 0)}
                    className="px-3 py-4 text-center text-neutral-500"
                  >
                    No hay fila de estadísticas de equipo para este partido.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {removedPlayers.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-neutral-700">Jugadores ausentes</h2>
          <p className="mt-1 text-xs text-neutral-500">
            No participaron en este partido. Reincorpóralos si los removiste por error.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {removedPlayers.map((p) => (
              <div
                key={p.matchPlayerStatId}
                className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
              >
                <span className="text-neutral-400 line-through">
                  #{p.jerseyNumber ?? '—'} {p.fullName}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleParticipation(p.matchPlayerStatId, true)}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Reincorporar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
