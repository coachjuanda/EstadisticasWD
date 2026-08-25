import type ExcelJS from 'exceljs';
import type { ReportPlayerRow, ReportStatDef, ReportTeamStats } from '../types';

const bySortOrder = (a: ReportStatDef, b: ReportStatDef) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
  });
}

export function addStatsSheets(
  workbook: ExcelJS.Workbook,
  {
    teamName,
    fieldPlayers,
    goalies,
    teamStats,
    statDefs,
  }: {
    teamName: string;
    fieldPlayers: ReportPlayerRow[];
    goalies: ReportPlayerRow[];
    teamStats: ReportTeamStats;
    statDefs: ReportStatDef[];
  }
) {
  const fieldStatDefs = statDefs.filter((s) => s.scope === 'jugador' && s.appliesTo === 'jugador_de_campo').sort(bySortOrder);
  const goalieStatDefs = statDefs.filter((s) => s.scope === 'jugador' && s.appliesTo === 'portero').sort(bySortOrder);
  const teamStatDefs = statDefs.filter((s) => s.scope === 'equipo').sort(bySortOrder);

  const hasPlusMinus = fieldStatDefs.some((s) => s.key === 'plus') && fieldStatDefs.some((s) => s.key === 'minus');
  const hasPpPair = teamStatDefs.some((s) => s.key === 'pp') && teamStatDefs.some((s) => s.key === 'pp_goal');
  const hasPkPair = teamStatDefs.some((s) => s.key === 'pk') && teamStatDefs.some((s) => s.key === 'pk_goal');

  // Jugadores
  const fieldSheet = workbook.addWorksheet('Jugadores');
  const fieldHeader = ['Jugador', ...fieldStatDefs.map((s) => s.label)];
  if (hasPlusMinus) fieldHeader.push('+/-');
  fieldSheet.addRow(fieldHeader);
  styleHeaderRow(fieldSheet.getRow(1));
  for (const p of fieldPlayers) {
    const row = [p.label, ...fieldStatDefs.map((s) => p.stats[s.key] ?? 0)];
    if (hasPlusMinus) row.push((p.stats.plus ?? 0) - (p.stats.minus ?? 0));
    fieldSheet.addRow(row);
  }
  fieldSheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 28 : 14;
  });

  // Porteros
  const goalieSheet = workbook.addWorksheet('Porteros');
  goalieSheet.addRow(['Portero', ...goalieStatDefs.map((s) => s.label), 'SV%']);
  styleHeaderRow(goalieSheet.getRow(1));
  for (const p of goalies) {
    const shots = p.stats.shots_received ?? 0;
    const goalsAgainst = p.stats.goals_received ?? 0;
    const savePct = shots > 0 ? Math.round(((shots - goalsAgainst) / shots) * 100) : null;
    goalieSheet.addRow([p.label, ...goalieStatDefs.map((s) => p.stats[s.key] ?? 0), savePct !== null ? `${savePct}%` : '—']);
  }
  goalieSheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 28 : 16;
  });

  // Equipo
  const teamSheet = workbook.addWorksheet('Equipo');
  const teamHeader = ['Equipo', ...teamStatDefs.map((s) => s.label)];
  if (hasPpPair) teamHeader.push('Efectividad PP');
  if (hasPkPair) teamHeader.push('Efectividad PK');
  teamSheet.addRow(teamHeader);
  styleHeaderRow(teamSheet.getRow(1));
  if (teamStats) {
    const ppCount = teamStats.stats.pp ?? 0;
    const ppGoalCount = teamStats.stats.pp_goal ?? 0;
    const pkCount = teamStats.stats.pk ?? 0;
    const pkGoalCount = teamStats.stats.pk_goal ?? 0;
    const ppEffectiveness = hasPpPair && ppCount > 0 ? Math.round((ppGoalCount / ppCount) * 100) : null;
    const pkEffectiveness = hasPkPair && pkCount > 0 ? Math.round(((pkCount - pkGoalCount) / pkCount) * 100) : null;
    const row = [teamName, ...teamStatDefs.map((s) => teamStats.stats[s.key] ?? 0)];
    if (hasPpPair) row.push(ppEffectiveness !== null ? `${ppEffectiveness}%` : '—');
    if (hasPkPair) row.push(pkEffectiveness !== null ? `${pkEffectiveness}%` : '—');
    teamSheet.addRow(row);
  }
  teamSheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 28 : 16;
  });
}
