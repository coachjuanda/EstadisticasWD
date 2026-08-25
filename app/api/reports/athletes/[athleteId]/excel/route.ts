import { createClient } from '@/lib/supabase/server';
import { loadAthleteProfile } from '@/lib/reports/athleteProfile';
import { buildAthleteProfileExcel } from '@/lib/reports/excel/athleteProfileExcel';

export async function GET(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const tournamentId = new URL(request.url).searchParams.get('tournament_id') ?? undefined;
  const supabase = await createClient();

  const result = await loadAthleteProfile(supabase, athleteId, tournamentId);
  if (!result.ok) {
    return new Response('No autorizado', { status: result.reason === 'not_found' ? 404 : 403 });
  }

  const buffer = await buildAthleteProfileExcel(result.data);
  const filename = `perfil-${result.data.fullName}`.replace(/[^a-zA-Z0-9-]+/g, '-');

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  });
}
