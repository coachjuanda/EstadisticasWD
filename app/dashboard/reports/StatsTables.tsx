import type { ReportStatDef, ReportPlayerRow, ReportTeamStats } from '@/lib/reports/types';

export type { ReportStatDef, ReportPlayerRow, ReportTeamStats };

const bySortOrder = (a: ReportStatDef, b: ReportStatDef) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export function StatsTables({
  teamName,
  fieldPlayers,
  goalies,
  didNotPlay,
  teamStats,
  statDefs,
}: {
  teamName: string;
  fieldPlayers: ReportPlayerRow[];
  goalies: ReportPlayerRow[];
  didNotPlay?: { athleteId: string; label: string }[];
  teamStats: ReportTeamStats;
  statDefs: ReportStatDef[];
}) {
  const fieldStatDefs = statDefs
    .filter((s) => s.scope === 'jugador' && s.appliesTo === 'jugador_de_campo')
    .sort(bySortOrder);
  const goalieStatDefs = statDefs.filter((s) => s.scope === 'jugador' && s.appliesTo === 'portero').sort(bySortOrder);
  const teamStatDefs = statDefs.filter((s) => s.scope === 'equipo').sort(bySortOrder);

  const hasPlusMinus = fieldStatDefs.some((s) => s.key === 'plus') && fieldStatDefs.some((s) => s.key === 'minus');
  const hasPpPair = teamStatDefs.some((s) => s.key === 'pp') && teamStatDefs.some((s) => s.key === 'pp_goal');
  const hasPkPair = teamStatDefs.some((s) => s.key === 'pk') && teamStatDefs.some((s) => s.key === 'pk_goal');
  const ppCount = teamStats?.stats.pp ?? 0;
  const ppGoalCount = teamStats?.stats.pp_goal ?? 0;
  const pkCount = teamStats?.stats.pk ?? 0;
  const pkGoalCount = teamStats?.stats.pk_goal ?? 0;
  const ppEffectiveness = hasPpPair && ppCount > 0 ? Math.round((ppGoalCount / ppCount) * 100) : null;
  const pkEffectiveness = hasPkPair && pkCount > 0 ? Math.round(((pkCount - pkGoalCount) / pkCount) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      {didNotPlay && didNotPlay.length > 0 && (
        <p className="text-sm text-neutral-500">
          <span className="font-medium text-neutral-700">No participaron en este partido: </span>
          {didNotPlay.map((p) => p.label).join(', ')}
        </p>
      )}

      <section>
        <h2 className="text-sm font-semibold text-neutral-700">Jugadores</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-500">
                  Jugador
                </th>
                {fieldStatDefs.map((s) => (
                  <th key={s.id} className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    {s.label}
                  </th>
                ))}
                {hasPlusMinus && (
                  <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">+/-</th>
                )}
              </tr>
            </thead>
            <tbody>
              {fieldPlayers.map((p) => (
                <tr key={p.athleteId} className="border-b border-neutral-100 last:border-0">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-neutral-900">
                    {p.label}
                  </td>
                  {fieldStatDefs.map((s) => (
                    <td key={s.id} className="px-2 py-2 text-center tabular-nums text-neutral-700">
                      {p.stats[s.key] ?? 0}
                    </td>
                  ))}
                  {hasPlusMinus && (
                    <td className="px-2 py-2 text-center tabular-nums text-neutral-700">
                      {(p.stats.plus ?? 0) - (p.stats.minus ?? 0)}
                    </td>
                  )}
                </tr>
              ))}
              {fieldPlayers.length === 0 && (
                <tr>
                  <td
                    colSpan={fieldStatDefs.length + 1 + (hasPlusMinus ? 1 : 0)}
                    className="px-3 py-4 text-center text-neutral-500"
                  >
                    Sin jugadores de campo.
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
                  Portero
                </th>
                {goalieStatDefs.map((s) => (
                  <th key={s.id} className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
                    {s.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">SV%</th>
              </tr>
            </thead>
            <tbody>
              {goalies.map((p) => {
                const shots = p.stats.shots_received ?? 0;
                const goalsAgainst = p.stats.goals_received ?? 0;
                const savePct = shots > 0 ? Math.round(((shots - goalsAgainst) / shots) * 100) : null;

                return (
                  <tr key={p.athleteId} className="border-b border-neutral-100 last:border-0">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-neutral-900">
                      {p.label}
                    </td>
                    {goalieStatDefs.map((s) => (
                      <td key={s.id} className="px-2 py-2 text-center tabular-nums text-neutral-700">
                        {p.stats[s.key] ?? 0}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center tabular-nums text-neutral-700">
                      {savePct !== null ? `${savePct}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              {goalies.length === 0 && (
                <tr>
                  <td colSpan={goalieStatDefs.length + 2} className="px-3 py-4 text-center text-neutral-500">
                    Sin porteros.
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
                <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-500">
                  Equipo
                </th>
                {teamStatDefs.map((s) => (
                  <th key={s.id} className="whitespace-nowrap px-2 py-2 text-center font-medium text-neutral-500">
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
                <tr>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-neutral-900">
                    {teamName}
                  </td>
                  {teamStatDefs.map((s) => (
                    <td key={s.id} className="px-2 py-2 text-center tabular-nums text-neutral-700">
                      {teamStats.stats[s.key] ?? 0}
                    </td>
                  ))}
                  {hasPpPair && (
                    <td className="px-2 py-2 text-center tabular-nums text-neutral-700">
                      {ppEffectiveness !== null ? `${ppEffectiveness}%` : '—'}
                    </td>
                  )}
                  {hasPkPair && (
                    <td className="px-2 py-2 text-center tabular-nums text-neutral-700">
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
