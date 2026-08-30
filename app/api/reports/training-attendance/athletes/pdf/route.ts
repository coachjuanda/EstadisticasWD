import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { loadAthleteTrainingAttendance } from '@/lib/reports/trainingAttendance';
import { TrainingAttendanceAthletesPdf } from '@/lib/reports/pdf/TrainingAttendancePdf';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const supabase = await createClient();

  const result = await loadAthleteTrainingAttendance(supabase, {
    divisionIds: params.getAll('division_id'),
    dateFrom: params.get('date_from') ?? undefined,
    dateTo: params.get('date_to') ?? undefined,
    athleteId: params.get('athlete_id') ?? undefined,
  });
  if (!result.ok) {
    return new Response('No autorizado', { status: 403 });
  }

  const buffer = await renderToBuffer(TrainingAttendanceAthletesPdf({ data: result.data }));
  const filename = `asistencia-entrenamientos-deportistas${result.data.meta.athleteName ? `-${result.data.meta.athleteName}` : ''}`.replace(
    /[^a-zA-Z0-9-]+/g,
    '-'
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  });
}
