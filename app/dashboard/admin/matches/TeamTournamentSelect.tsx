'use client';

import { useState } from 'react';

type Tournament = { id: string; name: string };
type TeamOption = { id: string; name: string };

export function TeamTournamentSelect({
  idPrefix,
  tournaments,
  rostersByTournament,
  defaultTournamentId,
  defaultTeamId,
  defaultTeamName,
}: {
  idPrefix: string;
  tournaments: Tournament[];
  rostersByTournament: Record<string, TeamOption[]>;
  defaultTournamentId?: string;
  defaultTeamId?: string;
  defaultTeamName?: string;
}) {
  const [tournamentId, setTournamentId] = useState(defaultTournamentId ?? tournaments[0]?.id ?? '');

  let teamOptions = rostersByTournament[tournamentId] ?? [];
  // Si el equipo ya asignado no tiene nómina en el torneo actualmente
  // seleccionado (ej. la nómina se borró después de crear el partido), lo
  // agregamos igual como opción -- si no, el <select> caería en la primera
  // opción disponible y cambiaría el equipo del partido sin que el admin lo
  // haya pedido.
  if (defaultTeamId && !teamOptions.some((t) => t.id === defaultTeamId)) {
    teamOptions = [{ id: defaultTeamId, name: defaultTeamName ?? '(equipo actual)' }, ...teamOptions];
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor={`${idPrefix}-tournament`}>
          Torneo
        </label>
        <select
          id={`${idPrefix}-tournament`}
          name="tournament_id"
          required
          value={tournamentId}
          onChange={(e) => setTournamentId(e.target.value)}
          disabled={tournaments.length === 0}
          className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor={`${idPrefix}-team`}>
          Equipo local
        </label>
        <select
          id={`${idPrefix}-team`}
          name="home_team_id"
          required
          defaultValue={defaultTeamId}
          disabled={teamOptions.length === 0}
          className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
        >
          {teamOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {teamOptions.length === 0 && (
          <p className="text-xs text-amber-600">
            Este torneo no tiene equipos con nómina cargada.
          </p>
        )}
      </div>
    </>
  );
}
