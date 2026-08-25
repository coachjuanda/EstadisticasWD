export type ReportStatDef = {
  id: string;
  key: string;
  label: string;
  appliesTo: string | null;
  scope: 'jugador' | 'equipo';
  sortOrder: number | null;
};

export type ReportPlayerRow = {
  athleteId: string;
  label: string;
  stats: Record<string, number>;
};

export type ReportTeamStats = { stats: Record<string, number> } | null;
