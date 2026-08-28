export const REQUIRED_COLUMNS = ['torneo', 'equipo_local', 'rival', 'fecha_hora'] as const;
export const ALL_COLUMNS = ['torneo', 'equipo_local', 'rival', 'fecha_hora', 'cancha_ubicacion', 'scorekeeper'] as const;

// AAAA-MM-DD HH:MM (o con "T" en vez de espacio, por si alguien pega el
// mismo formato que produce el input datetime-local del formulario manual).
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/;

export type BulkMatchRowInput = {
  torneo: string;
  equipo_local: string;
  rival: string;
  fecha_hora: string;
  cancha_ubicacion: string;
  scorekeeper: string;
};

export type BulkMatchRowValidated = BulkMatchRowInput & {
  index: number;
  valid: boolean;
  errors: string[];
  tournament_id: string | null;
  home_team_id: string | null;
  scorekeeper_id: string | null;
  scheduled_at: string | null;
};

export type BulkMatchContext = {
  // key = nombre en minúsculas y sin espacios sobrantes
  tournamentsByName: Map<string, string>;
  teamsByName: Map<string, string>;
  scorekeepersByName: Map<string, string>;
  // key = `${team_id}:${tournament_id}`
  rosterPairs: Set<string>;
};

// Reutilizada tanto en la previsualización (con lo que existe en la base al
// momento de subir el archivo) como en la confirmación (con lo que existe al
// momento de crear, por si algo cambió entre medio) -- nunca se confía en el
// flag `valid` que venga del cliente, siempre se recalcula acá.
export function validateRows(rows: BulkMatchRowInput[], context: BulkMatchContext): BulkMatchRowValidated[] {
  return rows.map((r, index) => {
    const errors: string[] = [];
    const torneo = r.torneo.trim();
    const equipo_local = r.equipo_local.trim();
    const rival = r.rival.trim();
    const fecha_hora = r.fecha_hora.trim();
    const cancha_ubicacion = r.cancha_ubicacion.trim();
    const scorekeeper = r.scorekeeper.trim();

    let tournament_id: string | null = null;
    let home_team_id: string | null = null;
    let scorekeeper_id: string | null = null;
    let scheduled_at: string | null = null;

    if (!torneo) {
      errors.push('Falta el torneo.');
    } else {
      tournament_id = context.tournamentsByName.get(torneo.toLowerCase()) ?? null;
      if (!tournament_id) errors.push(`Torneo inexistente: "${torneo}".`);
    }

    if (!equipo_local) {
      errors.push('Falta el equipo local.');
    } else {
      home_team_id = context.teamsByName.get(equipo_local.toLowerCase()) ?? null;
      if (!home_team_id) {
        errors.push(`Equipo local inexistente: "${equipo_local}".`);
      } else if (tournament_id && !context.rosterPairs.has(`${home_team_id}:${tournament_id}`)) {
        errors.push(`"${equipo_local}" no tiene nómina cargada en el torneo "${torneo}".`);
      }
    }

    if (!rival) errors.push('Falta el rival.');

    if (!fecha_hora) {
      errors.push('Falta la fecha y hora.');
    } else if (!DATETIME_RE.test(fecha_hora)) {
      errors.push('Fecha/hora con formato inválido (usa AAAA-MM-DD HH:MM).');
    } else {
      scheduled_at = fecha_hora.replace(' ', 'T');
    }

    if (scorekeeper) {
      scorekeeper_id = context.scorekeepersByName.get(scorekeeper.toLowerCase()) ?? null;
      if (!scorekeeper_id) errors.push(`Scorekeeper inexistente: "${scorekeeper}".`);
    }

    return {
      index,
      torneo,
      equipo_local,
      rival,
      fecha_hora,
      cancha_ubicacion,
      scorekeeper,
      valid: errors.length === 0,
      errors,
      tournament_id,
      home_team_id,
      scorekeeper_id,
      scheduled_at,
    };
  });
}

export function parseCsvRows(
  text: string,
  parseCsv: (t: string) => string[][]
): BulkMatchRowInput[] | { columnError: string } {
  const raw = parseCsv(text);
  if (raw.length === 0) return { columnError: 'El archivo está vacío.' };

  const header = raw[0].map((h) => h.trim().toLowerCase());
  const indexOf: Record<string, number> = {};
  for (const col of ALL_COLUMNS) {
    indexOf[col] = header.indexOf(col);
  }

  const missing = REQUIRED_COLUMNS.filter((col) => indexOf[col] === -1);
  if (missing.length > 0) {
    return { columnError: `Faltan columnas obligatorias en el CSV: ${missing.join(', ')}.` };
  }

  return raw.slice(1).map((cols) => ({
    torneo: cols[indexOf.torneo] ?? '',
    equipo_local: cols[indexOf.equipo_local] ?? '',
    rival: cols[indexOf.rival] ?? '',
    fecha_hora: cols[indexOf.fecha_hora] ?? '',
    cancha_ubicacion: indexOf.cancha_ubicacion !== -1 ? cols[indexOf.cancha_ubicacion] ?? '' : '',
    scorekeeper: indexOf.scorekeeper !== -1 ? cols[indexOf.scorekeeper] ?? '' : '',
  }));
}
