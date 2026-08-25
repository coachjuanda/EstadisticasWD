export const REQUIRED_COLUMNS = ['nombre_completo', 'cedula', 'email', 'rol'] as const;
export const ALL_COLUMNS = ['nombre_completo', 'cedula', 'email', 'rol', 'posicion'] as const;

export const VALID_ROLES = ['admin', 'coach', 'scorekeeper', 'deportista'];
export const VALID_POSITIONS = ['jugador_de_campo', 'portero'];

export type BulkRowInput = {
  nombre_completo: string;
  cedula: string;
  email: string;
  rol: string;
  posicion: string;
};

export type BulkRowValidated = BulkRowInput & {
  index: number;
  valid: boolean;
  errors: string[];
};

// Reutilizada tanto en la previsualización (con lo que ya existe en la
// base al momento de subir el archivo) como en la confirmación (con lo que
// existe al momento de crear, por si algo cambió entre medio) -- nunca
// confiamos en el flag `valid` que venga del cliente, siempre se recalcula.
export function validateRows(
  rows: BulkRowInput[],
  existingCedulas: Set<string>,
  existingEmails: Set<string>
): BulkRowValidated[] {
  const cedulaCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();
  for (const r of rows) {
    const c = r.cedula.trim();
    if (c) cedulaCounts.set(c, (cedulaCounts.get(c) ?? 0) + 1);
    const e = r.email.trim().toLowerCase();
    if (e) emailCounts.set(e, (emailCounts.get(e) ?? 0) + 1);
  }

  return rows.map((r, index) => {
    const errors: string[] = [];
    const nombre_completo = r.nombre_completo.trim();
    const cedula = r.cedula.trim();
    const email = r.email.trim();
    const rol = r.rol.trim().toLowerCase();
    const posicionRaw = r.posicion.trim().toLowerCase();

    if (!nombre_completo) errors.push('Falta el nombre completo.');
    if (!cedula) errors.push('Falta la cédula.');
    if (!email) errors.push('Falta el email.');
    else if (!email.includes('@') || !email.includes('.')) errors.push('Email con formato inválido.');
    if (!rol) errors.push('Falta el rol.');
    else if (!VALID_ROLES.includes(rol)) errors.push(`Rol inválido: "${r.rol}".`);

    if (cedula && (cedulaCounts.get(cedula) ?? 0) > 1) errors.push('Cédula duplicada en el archivo.');
    if (cedula && existingCedulas.has(cedula)) errors.push('Ya existe un usuario con esta cédula.');

    if (email && (emailCounts.get(email.toLowerCase()) ?? 0) > 1) errors.push('Email duplicado en el archivo.');
    if (email && existingEmails.has(email.toLowerCase())) errors.push('Ya existe un usuario con este email.');

    if (posicionRaw && !VALID_POSITIONS.includes(posicionRaw)) {
      errors.push(`Posición inválida: "${r.posicion}" (debe ser jugador_de_campo o portero).`);
    }

    return {
      index,
      nombre_completo,
      cedula,
      email,
      rol,
      posicion: rol === 'deportista' ? posicionRaw || 'jugador_de_campo' : '',
      valid: errors.length === 0,
      errors,
    };
  });
}

export function parseCsvRows(text: string, parseCsv: (t: string) => string[][]): BulkRowInput[] | { columnError: string } {
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
    nombre_completo: cols[indexOf.nombre_completo] ?? '',
    cedula: cols[indexOf.cedula] ?? '',
    email: cols[indexOf.email] ?? '',
    rol: cols[indexOf.rol] ?? '',
    posicion: indexOf.posicion !== -1 ? cols[indexOf.posicion] ?? '' : '',
  }));
}
