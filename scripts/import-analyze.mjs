import ExcelJS from 'exceljs';

const JUAN_CEDULA = '1127226808';

function normStr(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function toCedula(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).trim();
}

function titleCase(s) {
  return s
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => (part.trim() === '' ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function usernameToken(s) {
  return stripAccents(s.toLowerCase()).replace(/[^a-z]/g, '');
}

function parseDob(v) {
  if (!v) return null;
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // formatos vistos: D/M/YYYY, DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null; // no reconocido
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('Documentos WD/Base General.xlsx');
const ws = wb.getWorksheet('BASE DE DATOS DE JUGADORES');

const rawRows = [];
for (let r = 3; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => row.getCell(c).value);
  const allEmpty = vals.every((v) => v === null || v === undefined || String(v).trim() === '');
  if (allEmpty) continue;
  const [cedula, apellidos, nombres, pos, dob, jersey, categoria, liga, velopro] = vals;
  rawRows.push({
    excelRow: r,
    cedula: toCedula(cedula),
    apellidos: normStr(apellidos),
    nombres: normStr(nombres),
    pos: normStr(pos),
    dob: parseDob(dob),
    dobRaw: dob,
    jersey: jersey ?? null,
    categoria: normStr(categoria),
    liga: normStr(liga),
    velopro: normStr(velopro),
  });
}

console.log('Total filas no vacías:', rawRows.length);

// Agrupar: por cédula si existe, si no por nombre normalizado (apellidos+nombres)
const groups = new Map(); // key -> array of rows
for (const row of rawRows) {
  const key = row.cedula
    ? `CED:${row.cedula}`
    : `NAME:${usernameToken(row.apellidos)}|${usernameToken(row.nombres)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}

console.log('Personas únicas tras dedup:', groups.size);

const people = [];
const warnings = [];
for (const [key, rows] of groups) {
  const first = rows[0];
  // chequear consistencia de posición y DOB entre filas del mismo grupo
  const positions = new Set(rows.map((r) => r.pos));
  const dobs = new Set(rows.map((r) => r.dob).filter(Boolean));
  if (positions.size > 1) {
    warnings.push(`Posición inconsistente para ${first.apellidos} ${first.nombres} (cedula ${first.cedula || 'sin cedula'}): ${[...positions].join(', ')} -- filas excel ${rows.map(r=>r.excelRow).join(',')}`);
  }
  if (dobs.size > 1) {
    warnings.push(`DOB inconsistente para ${first.apellidos} ${first.nombres} (cedula ${first.cedula || 'sin cedula'}): ${[...dobs].join(', ')} -- filas excel ${rows.map(r=>r.excelRow).join(',')}`);
  }

  const fullName = `${titleCase(first.nombres)} ${titleCase(first.apellidos)}`.replace(/\s+/g, ' ').trim();
  const position = first.pos === 'Portero' ? 'portero' : 'jugador_de_campo';

  people.push({
    key,
    cedula: first.cedula || null,
    fullName,
    position,
    dob: first.dob,
    categorias: [...new Set(rows.map((r) => r.categoria).filter(Boolean))],
    ligas: [...new Set(rows.map((r) => r.liga).filter(Boolean))],
    jersey: first.jersey,
    velopro: first.velopro || null,
    rowsCount: rows.length,
    excelRows: rows.map((r) => r.excelRow),
    nombresRaw: first.nombres,
    apellidosRaw: first.apellidos,
  });
}

// Generar username para los que no tienen cedula
const usedUsernames = new Set();
for (const p of people) {
  if (p.cedula) continue;
  const first_nombre = usernameToken(p.nombresRaw.split(/\s+/)[0] || '');
  const first_apellido = usernameToken(p.apellidosRaw.split(/\s+/)[0] || '');
  let base = `${first_nombre}.${first_apellido}`;
  let candidate = base;
  let n = 2;
  while (usedUsernames.has(candidate)) {
    candidate = `${base}${n}`;
    n++;
  }
  usedUsernames.add(candidate);
  p.username = candidate;
}

const isMe = (p) => p.cedula === JUAN_CEDULA;

const withCedula = people.filter((p) => p.cedula && !isMe(p));
const withoutCedula = people.filter((p) => !p.cedula);
const me = people.find(isMe);

console.log('\n=== RESUMEN ===');
console.log('Total personas únicas:', people.length);
console.log('  Con cédula real (se crean, excluyendo mi cuenta):', withCedula.length);
console.log('  Sin cédula -> usuario generado (se crean):', withoutCedula.length);
console.log('  Mi propia fila (se actualiza, no se crea):', me ? 1 : 0);
console.log('  TOTAL A CREAR:', withCedula.length + withoutCedula.length);

console.log('\n=== MI FILA ===');
console.log(me);

console.log('\n=== EJEMPLOS SIN CEDULA (usuario generado) ===');
for (const p of withoutCedula) {
  console.log(`  ${p.fullName} -> usuario: ${p.username} (filas excel: ${p.excelRows.join(',')})`);
}

console.log('\n=== ADVERTENCIAS (inconsistencias entre filas duplicadas) ===');
if (warnings.length === 0) console.log('  (ninguna)');
for (const w of warnings) console.log('  -', w);

console.log('\n=== EJEMPLOS DE PERSONAS CON VARIAS FILAS (categorías/ligas múltiples) ===');
for (const p of people.filter((p) => p.rowsCount > 1).slice(0, 8)) {
  console.log(`  ${p.fullName} (cedula ${p.cedula}) -- ${p.rowsCount} filas, categorias: [${p.categorias.join(' | ')}], ligas: [${p.ligas.join(' | ')}]`);
}

console.log('\nTotal personas con >1 fila en excel:', people.filter(p=>p.rowsCount>1).length);
console.log('DOBs no reconocidos (ni Date ni D/M/YYYY):', rawRows.filter(r => r.dobRaw && !r.dob).map(r => ({row: r.excelRow, raw: r.dobRaw})));

console.log('\n=== Variación de jersey/velopro en personas con >1 fila ===');
for (const [key, rows] of groups) {
  if (rows.length <= 1) continue;
  const jerseys = new Set(rows.map(r => r.jersey ?? '').filter(v => v !== ''));
  const veloids = new Set(rows.map(r => r.velopro).filter(Boolean));
  if (jerseys.size > 1 || veloids.size > 1) {
    console.log(` ${rows[0].apellidos} ${rows[0].nombres}: jerseys=[${[...jerseys]}] velopro=[${[...veloids]}]`);
  }
}
