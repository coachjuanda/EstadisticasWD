import { createClient } from '@/lib/supabase/server';
import { loadCoachTrainingAttendance } from '@/lib/reports/trainingAttendance';
import { buildTrainingAttendanceCoachesExcel } from '@/lib/reports/excel/trainingAttendanceExcel';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const supabase = await createClient();

  const result = await loadCoachTrainingAttendance(supabase, {
    dateFrom: params.get('date_from') ?? undefined,
    dateTo: params.get('date_to') ?? undefined,
    coachId: params.get('coach_id') ?? undefined,
  });
  if (!result.ok) {
    return new Response('No autorizado', { status: 403 });
  }

  const buffer = await buildTrainingAttendanceCoachesExcel(result.data);
  const filename = `asistencia-entrenamientos-entrenadores${result.data.meta.coachName ? `-${result.data.meta.coachName}` : ''}`.replace(
    /[^a-zA-Z0-9-]+/g,
    '-'
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  });
}
