import ExcelJS from 'exceljs';
import type { AthleteProfileData } from '../athleteProfile';

export async function buildAthleteProfileExcel(athlete: AthleteProfileData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hockey.One';

  const tournamentLabel = athlete.selectedTournamentId
    ? athlete.tournamentsPlayed.find((t) => t.id === athlete.selectedTournamentId)?.name ?? '—'
    : 'Acumulado';
  const scopeLabel = athlete.selectedSportLabel
    ? `${athlete.selectedSportLabel} · ${tournamentLabel}`
    : 'Sin actividad registrada';

  const sheet = workbook.addWorksheet('Perfil');
  sheet.addRow([athlete.fullName]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([athlete.positionLabel]);
  if (athlete.teams.length > 0) sheet.addRow(['Equipos', athlete.teams.join(', ')]);
  sheet.addRow(['Vista', scopeLabel]);
  sheet.addRow([]);

  sheet.addRow(['Estadística', 'Valor']);
  sheet.getRow(sheet.lastRow!.number).font = { bold: true };
  for (const s of athlete.statCards) {
    sheet.addRow([s.label, s.value]);
  }
  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 16;

  if (athlete.teamMemberships.length > 0) {
    sheet.addRow([]);
    sheet.addRow(['Equipo', 'Torneo']);
    sheet.getRow(sheet.lastRow!.number).font = { bold: true };
    for (const m of athlete.teamMemberships) {
      sheet.addRow([m.teamName, m.tournamentName]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
