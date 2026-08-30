import ExcelJS from 'exceljs';
import type { AthleteTrainingAttendanceData, CoachTrainingAttendanceData } from '../trainingAttendance';

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function rangeLabel(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return 'Todo el histórico';
  if (dateFrom && dateTo) return `${dateFrom} a ${dateTo}`;
  if (dateFrom) return `Desde ${dateFrom}`;
  return `Hasta ${dateTo}`;
}

export async function buildTrainingAttendanceAthletesExcel(data: AthleteTrainingAttendanceData): Promise<Buffer> {
  const { summary, detail, meta } = data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hockey.One';

  const sheet = workbook.addWorksheet('Asistencia');
  sheet.addRow(['Asistencia a entrenamientos — Deportistas']);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow(['Rango', rangeLabel(meta.dateFrom, meta.dateTo)]);
  if (meta.divisionNames.length > 0) sheet.addRow(['Divisiones', meta.divisionNames.join(', ')]);
  if (meta.athleteName) sheet.addRow(['Deportista', meta.athleteName]);
  if (meta.sportLabel) sheet.addRow(['Deporte', meta.sportLabel]);
  sheet.addRow([]);

  if (meta.athleteName) {
    sheet.addRow(['Fecha', 'División', 'Estado']);
    sheet.getRow(sheet.lastRow!.number).font = { bold: true };
    for (const d of detail) {
      sheet.addRow([formatDate(d.scheduledAt), d.divisionNames, d.present ? 'Presente' : 'Ausente']);
    }
  } else {
    sheet.addRow(['Deportista', 'Deporte', 'Convocatorias', 'Presentes', '%']);
    sheet.getRow(sheet.lastRow!.number).font = { bold: true };
    for (const a of summary) {
      sheet.addRow([a.fullName, a.sportLabel, a.total, a.present, `${a.pct}%`]);
    }
  }
  sheet.getColumn(1).width = 30;
  sheet.getColumn(2).width = 20;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 10;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildTrainingAttendanceCoachesExcel(data: CoachTrainingAttendanceData): Promise<Buffer> {
  const { summary, detail, meta } = data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hockey.One';

  const sheet = workbook.addWorksheet('Asistencia');
  sheet.addRow(['Asistencia a entrenamientos — Entrenadores']);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow(['Rango', rangeLabel(meta.dateFrom, meta.dateTo)]);
  if (meta.coachName) sheet.addRow(['Entrenador', meta.coachName]);
  if (meta.sportLabel) sheet.addRow(['Deporte', meta.sportLabel]);
  sheet.addRow([]);

  if (meta.coachName) {
    sheet.addRow(['Fecha', 'División']);
    sheet.getRow(sheet.lastRow!.number).font = { bold: true };
    for (const d of detail) {
      sheet.addRow([formatDate(d.scheduledAt), d.divisionNames]);
    }
  } else {
    sheet.addRow(['Entrenador', 'Deporte', 'Sesiones presente']);
    sheet.getRow(sheet.lastRow!.number).font = { bold: true };
    for (const c of summary) {
      sheet.addRow([c.fullName, c.sportLabel, c.sessionsPresent]);
    }
  }
  sheet.getColumn(1).width = 30;
  sheet.getColumn(2).width = 20;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
