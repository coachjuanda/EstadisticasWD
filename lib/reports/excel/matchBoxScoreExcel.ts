import ExcelJS from 'exceljs';
import { addStatsSheets } from './statsSheets';
import type { MatchBoxScoreData } from '../matchBoxScore';

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado',
  en_vivo: 'En vivo',
  finalizado: 'Finalizado',
};

export async function buildMatchBoxScoreExcel(match: MatchBoxScoreData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hockey.One';

  const info = workbook.addWorksheet('Info');
  info.addRow(['Box score']);
  info.getRow(1).font = { bold: true, size: 14 };
  info.addRow([]);
  info.addRow(['Local', match.homeTeamName]);
  info.addRow(['Visitante', match.awayTeamName]);
  info.addRow(['Marcador', `${match.homeScore} - ${match.awayScore}`]);
  info.addRow(['Torneo', match.tournamentName]);
  info.addRow(['Fecha', new Date(match.scheduledAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })]);
  if (match.location) info.addRow(['Cancha', match.location]);
  info.addRow(['Estado', STATUS_LABELS[match.status] ?? match.status]);
  if (match.didNotPlay.length > 0) {
    info.addRow(['No participaron', match.didNotPlay.map((p) => p.label).join(', ')]);
  }
  info.getColumn(1).width = 14;
  info.getColumn(2).width = 30;

  addStatsSheets(workbook, {
    teamName: match.homeTeamName,
    fieldPlayers: match.fieldPlayers,
    goalies: match.goalies,
    teamStats: match.teamStats,
    statDefs: match.statDefs,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
