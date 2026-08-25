import { createClient } from '@/lib/supabase/server';
import { loadMatchBoxScore } from '@/lib/reports/matchBoxScore';
import { buildMatchBoxScoreExcel } from '@/lib/reports/excel/matchBoxScoreExcel';

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();

  const result = await loadMatchBoxScore(supabase, matchId);
  if (!result.ok) {
    return new Response('No autorizado', { status: result.reason === 'not_found' ? 404 : 403 });
  }

  const buffer = await buildMatchBoxScoreExcel(result.data);
  const filename = `box-score-${result.data.homeTeamName}-vs-${result.data.awayTeamName}`.replace(/[^a-zA-Z0-9-]+/g, '-');

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  });
}
