import ExcelJS from 'exceljs';
import { addStatsSheets } from './statsSheets';
import type { TeamSummaryData } from '../teamSummary';

export async function buildTeamSummaryExcel(summary: TeamSummaryData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hockey.One';

  const info = workbook.addWorksheet('Info');
  info.addRow(['Resumen de equipo']);
  info.getRow(1).font = { bold: true, size: 14 };
  info.addRow([]);
  info.addRow(['Equipo', summary.teamName]);
  if (summary.divisionName) info.addRow(['División', summary.divisionName]);
  info.addRow(['Torneo', summary.tournamentName]);
  info.addRow(['Partidos considerados', summary.matchesConsidered]);
  info.getColumn(1).width = 20;
  info.getColumn(2).width = 30;

  addStatsSheets(workbook, {
    teamName: summary.teamName,
    fieldPlayers: summary.fieldPlayers,
    goalies: summary.goalies,
    teamStats: summary.teamStats,
    statDefs: summary.statDefs,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
