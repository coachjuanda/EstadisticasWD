export type TournamentGroup<T> = {
  tournamentId: string;
  tournamentName: string;
  matches: T[];
};

// Agrupa una lista de partidos ya ordenada por fecha, preservando ese orden
// dentro de cada grupo. El orden de los grupos sigue el orden de aparición
// del primer partido de cada torneo en la lista de entrada -- así una lista
// ya ordenada desc/asc por fecha no necesita un criterio de orden aparte
// para los encabezados de torneo.
export function groupMatchesByTournament<
  T extends { tournament_id: string; tournaments: { name: string } | null },
>(matches: T[]): TournamentGroup<T>[] {
  const groups = new Map<string, TournamentGroup<T>>();

  for (const match of matches) {
    const tournamentId = match.tournament_id;
    if (!groups.has(tournamentId)) {
      groups.set(tournamentId, {
        tournamentId,
        tournamentName: match.tournaments?.name ?? 'Sin torneo',
        matches: [],
      });
    }
    groups.get(tournamentId)!.matches.push(match);
  }

  return [...groups.values()];
}

// Índice del grupo que debe abrirse por default en el acordeón: el torneo
// con el partido más reciente (mayor scheduled_at) entre todos -- no
// depende de si la lista de entrada venía ordenada asc o desc, así el
// criterio es el mismo en las 4 pantallas que listan partidos (admin,
// coach, scorekeeper, deportista) sin importar cómo cada una ordena su
// query. Con un solo grupo, ese es trivialmente el resultado.
export function indexOfMostRecentGroup<T extends { scheduled_at: string }>(groups: TournamentGroup<T>[]): number {
  let bestIdx = 0;
  let bestDate = '';
  groups.forEach((group, idx) => {
    const groupMaxDate = group.matches.reduce((max, m) => (m.scheduled_at > max ? m.scheduled_at : max), '');
    if (groupMaxDate > bestDate) {
      bestDate = groupMaxDate;
      bestIdx = idx;
    }
  });
  return bestIdx;
}
