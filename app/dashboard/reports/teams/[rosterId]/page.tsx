import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Esta pantalla se fusionó dentro de /dashboard/team-stats/[teamId] (tarjetas
// + tabla de jugadores ordenable + gráfica de tendencia, todo junto). Queda
// como redirect en vez de borrarse del todo para que ningún link/bookmark
// viejo hacia acá caiga en un 404 -- el control de acceso real lo hace el
// destino (loadTeamStats), esta pantalla solo resuelve el team_id/torneo.
export default async function TeamSummaryRedirectPage({
  params,
}: {
  params: Promise<{ rosterId: string }>;
}) {
  const { rosterId } = await params;
  const supabase = await createClient();

  const { data: roster } = await supabase
    .from('rosters')
    .select('team_id, tournament_id')
    .eq('id', rosterId)
    .maybeSingle();

  if (!roster) {
    redirect('/dashboard?error=unauthorized');
  }

  redirect(`/dashboard/team-stats/${roster.team_id}?tournament_id=${roster.tournament_id}`);
}
