import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { loadTeamSummary } from '@/lib/reports/teamSummary';
import { TeamSummaryPdf } from '@/lib/reports/pdf/TeamSummaryPdf';

export async function GET(_request: Request, { params }: { params: Promise<{ rosterId: string }> }) {
  const { rosterId } = await params;
  const supabase = await createClient();

  const result = await loadTeamSummary(supabase, rosterId);
  if (!result.ok) {
    return new Response('No autorizado', { status: result.reason === 'not_found' ? 404 : 403 });
  }

  const buffer = await renderToBuffer(TeamSummaryPdf({ summary: result.data }));
  const filename = `resumen-equipo-${result.data.teamName}-${result.data.tournamentName}`.replace(/[^a-zA-Z0-9-]+/g, '-');

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  });
}
