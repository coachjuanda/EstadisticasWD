'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { TeamStatDef, TeamStatMatchPoint } from '@/lib/team-stats/loadTeamStats';

// Paleta categórica validada (skill de dataviz): 8 tonos, orden fijo, pasa
// separación CVD y umbral de visión normal sobre fondo blanco. Se usa solo
// para las líneas por jugador -- la línea de equipo usa la tinta de marca,
// no un color categórico, para que nunca compita por el mismo "slot" visual.
const CATEGORICAL_PALETTE = [
  '#2a78d6', // azul
  '#eb6834', // naranja
  '#1baf7a', // aqua
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // rojo
];
const MAX_PLAYERS = CATEGORICAL_PALETTE.length;
const TEAM_COLOR = '#1a1a1a';

type PlayerOption = { athleteId: string; label: string; jerseyNumber: number | null };

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-neutral-500">{label}</p>
      <div className="mt-1 flex flex-col gap-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3" style={{ backgroundColor: p.color }} />
            <span className="font-semibold tabular-nums text-neutral-900">{p.value}</span>
            <span className="text-neutral-500">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamStatsChart({
  matches,
  statDefs,
  viewerRole,
  viewerAthleteId,
}: {
  matches: TeamStatMatchPoint[];
  statDefs: TeamStatDef[];
  viewerRole: string;
  viewerAthleteId: string | null;
}) {
  const playedMatches = useMemo(() => matches.filter((m) => m.played), [matches]);

  const orderedStatDefs = useMemo(
    () => [...statDefs].sort((a, b) => (a.scope === b.scope ? (a.sortOrder ?? 0) - (b.sortOrder ?? 0) : a.scope === 'jugador' ? -1 : 1)),
    [statDefs]
  );

  const [statKey, setStatKey] = useState<string>(orderedStatDefs[0]?.key ?? '');
  const selectedStatDef = orderedStatDefs.find((s) => s.key === statKey) ?? null;

  // El deportista entra viendo su propia línea junto a la del equipo -- es la
  // razón por la que abrió esta pantalla. Admin/coach entran viendo solo la
  // línea de equipo, sin saturar de una vez con todo el roster.
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(
    viewerRole === 'deportista' && viewerAthleteId ? [viewerAthleteId] : []
  );
  const [comparing, setComparing] = useState(viewerRole === 'deportista');

  // Slot de color estable por jugador: una vez asignado no cambia aunque se
  // quite y se vuelva a agregar otro jugador -- "el color sigue a la
  // identidad, nunca a la posición en la selección actual". Se guarda como
  // estado (no un ref) para que sea seguro leerlo durante el render -- solo
  // crece (nunca se reordena), así que un jugador quitado y re-agregado
  // conserva su color.
  const [colorOrder, setColorOrder] = useState<string[]>(
    viewerRole === 'deportista' && viewerAthleteId ? [viewerAthleteId] : []
  );
  function colorFor(athleteId: string): string {
    const slot = colorOrder.indexOf(athleteId);
    return CATEGORICAL_PALETTE[slot === -1 ? 0 : slot % MAX_PLAYERS];
  }

  const playerOptions = useMemo<PlayerOption[]>(() => {
    const byId = new Map<string, PlayerOption>();
    for (const m of playedMatches) {
      for (const p of m.playerStats) {
        if (!byId.has(p.athleteId)) {
          byId.set(p.athleteId, {
            athleteId: p.athleteId,
            label: `#${p.jerseyNumber ?? '—'} ${p.fullName}`,
            jerseyNumber: p.jerseyNumber,
          });
        }
      }
    }
    return [...byId.values()].sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));
  }, [playedMatches]);

  const chartData = useMemo(() => {
    if (!selectedStatDef) return [];
    return playedMatches.map((m) => {
      const row: Record<string, number | string> = {
        date: new Date(m.scheduledAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
        fullDate: new Date(m.scheduledAt).toLocaleDateString('es-CO', { dateStyle: 'medium' }),
        equipo: m.teamStats?.[statKey] ?? 0,
      };
      if (selectedStatDef.scope === 'jugador') {
        for (const p of m.playerStats) {
          row[p.athleteId] = p.stats[statKey] ?? 0;
        }
      }
      return row;
    });
  }, [playedMatches, selectedStatDef, statKey]);

  function togglePlayer(athleteId: string) {
    if (selectedPlayers.includes(athleteId)) {
      setSelectedPlayers((prev) => prev.filter((id) => id !== athleteId));
      return;
    }
    if (selectedPlayers.length >= MAX_PLAYERS) return;
    setSelectedPlayers((prev) => [...prev, athleteId]);
    setColorOrder((prev) => (prev.includes(athleteId) ? prev : [...prev, athleteId]));
  }

  if (playedMatches.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-neutral-200 p-6 text-center text-sm text-neutral-500">
        Todavía no hay partidos jugados en este torneo para graficar.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="stat-select">
            Estadística
          </label>
          <select
            id="stat-select"
            value={statKey}
            onChange={(e) => setStatKey(e.target.value)}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            {orderedStatDefs.map((s) => (
              <option key={s.id} value={s.key}>
                {s.label}
                {s.scope === 'equipo' ? ' (equipo)' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedStatDef?.scope === 'jugador' && (
          <button
            type="button"
            onClick={() => setComparing((v) => !v)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            {comparing ? 'Ocultar comparación por jugador' : 'Comparar jugadores'}
          </button>
        )}
      </div>

      {comparing && selectedStatDef?.scope === 'jugador' && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          {playerOptions.map((p) => {
            const checked = selectedPlayers.includes(p.athleteId);
            const disabled = !checked && selectedPlayers.length >= MAX_PLAYERS;
            return (
              <label
                key={p.athleteId}
                className={`flex items-center gap-1.5 text-xs ${disabled ? 'text-neutral-400' : 'text-neutral-700'}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => togglePlayer(p.athleteId)}
                />
                {p.label}
              </label>
            );
          })}
          {selectedPlayers.length >= MAX_PLAYERS && (
            <p className="w-full text-xs text-neutral-400">Máximo {MAX_PLAYERS} jugadores a la vez.</p>
          )}
        </div>
      )}

      <div className="mt-4 h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#898781' }}
              axisLine={{ stroke: '#c3c2b7' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#898781' }}
              axisLine={false}
              tickLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {(comparing && selectedStatDef?.scope === 'jugador' ? selectedPlayers.length > 0 : false) && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#52514e' }}
                formatter={(value: string) => value}
              />
            )}
            <Line
              type="monotone"
              dataKey="equipo"
              name="Equipo (total)"
              stroke={TEAM_COLOR}
              strokeWidth={3}
              dot={{ r: 3, fill: TEAM_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            {comparing &&
              selectedStatDef?.scope === 'jugador' &&
              selectedPlayers.map((athleteId) => {
                const opt = playerOptions.find((p) => p.athleteId === athleteId);
                return (
                  <Line
                    key={athleteId}
                    type="monotone"
                    dataKey={athleteId}
                    name={opt?.label ?? athleteId}
                    stroke={colorFor(athleteId)}
                    strokeWidth={2}
                    dot={{ r: 3, fill: colorFor(athleteId), strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                );
              })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
