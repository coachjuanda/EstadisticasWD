'use client';

import { useMemo, useState } from 'react';
import type { TeamStatDef, TeamSeasonPlayerRow } from '@/lib/team-stats/loadTeamStats';

type SortDir = 'asc' | 'desc';

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null;
  return <span className="ml-0.5 text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>;
}

const bySortOrder = (a: TeamStatDef, b: TeamStatDef) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

// Fila líder de una columna: fondo ámbar sutil + negrita, nunca solo para
// columnas en cero (si nadie ha anotado todavía, "liderar con 0" no dice
// nada -- así que no se resalta).
function leaderCellClass(value: number, max: number): string {
  return max > 0 && value === max ? 'bg-amber-50 font-bold text-amber-900' : 'text-neutral-700';
}

function fieldValue(p: TeamSeasonPlayerRow, key: string): number {
  if (key === 'plus_minus') return (p.stats.plus ?? 0) - (p.stats.minus ?? 0);
  return p.stats[key] ?? 0;
}

function savePct(p: TeamSeasonPlayerRow): number | null {
  const shots = p.stats.shots_received ?? 0;
  const goalsAgainst = p.stats.goals_received ?? 0;
  return shots > 0 ? Math.round(((shots - goalsAgainst) / shots) * 100) : null;
}

function goalieValue(p: TeamSeasonPlayerRow, key: string): number {
  if (key === 'save_pct') return savePct(p) ?? -1;
  return p.stats[key] ?? 0;
}

export function TeamRosterTables({
  teamName,
  fieldPlayers,
  goalies,
  teamStats,
  statDefs,
}: {
  teamName: string;
  fieldPlayers: TeamSeasonPlayerRow[];
  goalies: TeamSeasonPlayerRow[];
  teamStats: Record<string, number> | null;
  statDefs: TeamStatDef[];
}) {
  const fieldStatDefs = useMemo(
    () => statDefs.filter((s) => s.scope === 'jugador' && s.appliesTo === 'jugador_de_campo').sort(bySortOrder),
    [statDefs]
  );
  const goalieStatDefs = useMemo(
    () => statDefs.filter((s) => s.scope === 'jugador' && s.appliesTo === 'portero').sort(bySortOrder),
    [statDefs]
  );
  const teamStatDefs = useMemo(() => statDefs.filter((s) => s.scope === 'equipo').sort(bySortOrder), [statDefs]);

  const hasPlusMinus = fieldStatDefs.some((s) => s.key === 'plus') && fieldStatDefs.some((s) => s.key === 'minus');
  const hasPpPair = teamStatDefs.some((s) => s.key === 'pp') && teamStatDefs.some((s) => s.key === 'pp_goal');
  const hasPkPair = teamStatDefs.some((s) => s.key === 'pk') && teamStatDefs.some((s) => s.key === 'pk_goal');

  // ---- Jugadores: ordenable, líder resaltado ----
  const [fieldSortKey, setFieldSortKey] = useState<string>('jersey');
  const [fieldSortDir, setFieldSortDir] = useState<SortDir>('asc');

  function handleFieldSort(key: string) {
    if (key === fieldSortKey) {
      setFieldSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setFieldSortKey(key);
      setFieldSortDir(key === 'jersey' ? 'asc' : 'desc');
    }
  }

  const sortedFieldPlayers = useMemo(() => {
    const list = [...fieldPlayers];
    list.sort((a, b) => {
      const cmp =
        fieldSortKey === 'jersey' ? (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) : fieldValue(a, fieldSortKey) - fieldValue(b, fieldSortKey);
      return fieldSortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [fieldPlayers, fieldSortKey, fieldSortDir]);

  const fieldMax = useMemo(() => {
    const max: Record<string, number> = {};
    for (const s of fieldStatDefs) max[s.key] = Math.max(0, ...fieldPlayers.map((p) => p.stats[s.key] ?? 0));
    if (hasPlusMinus) max.plus_minus = Math.max(0, ...fieldPlayers.map((p) => (p.stats.plus ?? 0) - (p.stats.minus ?? 0)));
    return max;
  }, [fieldPlayers, fieldStatDefs, hasPlusMinus]);

  // ---- Porteros: ordenable, SV% calculado y resaltado ----
  const [goalieSortKey, setGoalieSortKey] = useState<string>('jersey');
  const [goalieSortDir, setGoalieSortDir] = useState<SortDir>('asc');

  function handleGoalieSort(key: string) {
    if (key === goalieSortKey) {
      setGoalieSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setGoalieSortKey(key);
      setGoalieSortDir(key === 'jersey' ? 'asc' : 'desc');
    }
  }

  const sortedGoalies = useMemo(() => {
    const list = [...goalies];
    list.sort((a, b) => {
      const cmp =
        goalieSortKey === 'jersey' ? (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) : goalieValue(a, goalieSortKey) - goalieValue(b, goalieSortKey);
      return goalieSortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [goalies, goalieSortKey, goalieSortDir]);

  const goalieMax = useMemo(() => {
    const max: Record<string, number> = {};
    for (const s of goalieStatDefs) max[s.key] = Math.max(0, ...goalies.map((p) => p.stats[s.key] ?? 0));
    max.save_pct = Math.max(0, ...goalies.map((p) => savePct(p) ?? 0));
    return max;
  }, [goalies, goalieStatDefs]);

  const ppCount = teamStats?.pp ?? 0;
  const ppGoalCount = teamStats?.pp_goal ?? 0;
  const pkCount = teamStats?.pk ?? 0;
  const pkGoalCount = teamStats?.pk_goal ?? 0;
  const ppEffectiveness = hasPpPair && ppCount > 0 ? Math.round((ppGoalCount / ppCount) * 100) : null;
  const pkEffectiveness = hasPkPair && pkCount > 0 ? Math.round(((pkCount - pkGoalCount) / pkCount) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold text-neutral-700">Jugadores</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-500">
                  <button type="button" onClick={() => handleFieldSort('jersey')} className="flex items-center hover:text-neutral-900">
                    Jugador
                    <SortIndicator active={fieldSortKey === 'jersey'} dir={fieldSortDir} />
                  </button>
                </th>
                {fieldStatDefs.map((s) => (
                  <th key={s.id} className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    <button type="button" onClick={() => handleFieldSort(s.key)} className="flex items-center justify-center hover:text-neutral-900">
                      {s.label}
                      <SortIndicator active={fieldSortKey === s.key} dir={fieldSortDir} />
                    </button>
                  </th>
                ))}
                {hasPlusMinus && (
                  <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    <button
                      type="button"
                      onClick={() => handleFieldSort('plus_minus')}
                      className="flex items-center justify-center hover:text-neutral-900"
                    >
                      +/-
                      <SortIndicator active={fieldSortKey === 'plus_minus'} dir={fieldSortDir} />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedFieldPlayers.map((p) => (
                <tr key={p.athleteId} className="border-b border-neutral-100 last:border-0">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-neutral-900">
                    #{p.jerseyNumber ?? '—'} {p.fullName}
                  </td>
                  {fieldStatDefs.map((s) => {
                    const value = p.stats[s.key] ?? 0;
                    return (
                      <td key={s.id} className={`px-2 py-1.5 text-center tabular-nums ${leaderCellClass(value, fieldMax[s.key])}`}>
                        {value}
                      </td>
                    );
                  })}
                  {hasPlusMinus &&
                    (() => {
                      const value = (p.stats.plus ?? 0) - (p.stats.minus ?? 0);
                      return (
                        <td className={`px-2 py-1.5 text-center tabular-nums ${leaderCellClass(value, fieldMax.plus_minus)}`}>
                          {value}
                        </td>
                      );
                    })()}
                </tr>
              ))}
              {sortedFieldPlayers.length === 0 && (
                <tr>
                  <td colSpan={fieldStatDefs.length + 1 + (hasPlusMinus ? 1 : 0)} className="px-3 py-4 text-center text-neutral-500">
                    Sin jugadores de campo con estadísticas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-700">Porteros</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-500">
                  <button type="button" onClick={() => handleGoalieSort('jersey')} className="flex items-center hover:text-neutral-900">
                    Portero
                    <SortIndicator active={goalieSortKey === 'jersey'} dir={goalieSortDir} />
                  </button>
                </th>
                {goalieStatDefs.map((s) => (
                  <th key={s.id} className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    <button type="button" onClick={() => handleGoalieSort(s.key)} className="flex items-center justify-center hover:text-neutral-900">
                      {s.label}
                      <SortIndicator active={goalieSortKey === s.key} dir={goalieSortDir} />
                    </button>
                  </th>
                ))}
                <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                  <button
                    type="button"
                    onClick={() => handleGoalieSort('save_pct')}
                    className="flex items-center justify-center hover:text-neutral-900"
                  >
                    SV%
                    <SortIndicator active={goalieSortKey === 'save_pct'} dir={goalieSortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGoalies.map((p) => {
                const pct = savePct(p);
                return (
                  <tr key={p.athleteId} className="border-b border-neutral-100 last:border-0">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-neutral-900">
                      #{p.jerseyNumber ?? '—'} {p.fullName}
                    </td>
                    {goalieStatDefs.map((s) => {
                      const value = p.stats[s.key] ?? 0;
                      return (
                        <td key={s.id} className={`px-2 py-1.5 text-center tabular-nums ${leaderCellClass(value, goalieMax[s.key])}`}>
                          {value}
                        </td>
                      );
                    })}
                    <td className={`px-2 py-1.5 text-center tabular-nums ${leaderCellClass(pct ?? -1, goalieMax.save_pct)}`}>
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              {sortedGoalies.length === 0 && (
                <tr>
                  <td colSpan={goalieStatDefs.length + 2} className="px-3 py-4 text-center text-neutral-500">
                    Sin porteros con estadísticas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-700">Estadísticas de equipo</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-500">Equipo</th>
                {teamStatDefs.map((s) => (
                  <th key={s.id} className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    {s.label}
                  </th>
                ))}
                {hasPpPair && <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">Efectividad PP</th>}
                {hasPkPair && <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">Efectividad PK</th>}
              </tr>
            </thead>
            <tbody>
              {teamStats ? (
                <tr>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-neutral-900">{teamName}</td>
                  {teamStatDefs.map((s) => (
                    <td key={s.id} className="px-2 py-1.5 text-center tabular-nums text-neutral-700">
                      {teamStats[s.key] ?? 0}
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
                    No hay estadísticas de equipo registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
