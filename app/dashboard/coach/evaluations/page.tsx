import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type AthleteRow = { id: string; full_name: string; division_id: string };
type ReportRow = { id: string; athlete_id: string; report_date: string };
type RosterPlayerRow = { athlete_id: string; roster_id: string; athlete_profiles: { full_name: string } | null };

export default async function CoachEvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: coachTeams } = await supabase.from('coach_teams').select('team_id').eq('coach_id', user!.id);
  const teamIds = (coachTeams ?? []).map((t) => t.team_id);

  let athletes: AthleteRow[] = [];

  if (teamIds.length > 0) {
    const [{ data: teams }, { data: rosters }] = await Promise.all([
      supabase.from('teams').select('id, division_id').in('id', teamIds),
      supabase.from('rosters').select('id, team_id').in('team_id', teamIds),
    ]);

    const divisionByTeam = new Map((teams ?? []).map((t) => [t.id, t.division_id]));
    const teamByRoster = new Map((rosters ?? []).map((r) => [r.id, r.team_id]));
    const rosterIds = (rosters ?? []).map((r) => r.id);

    if (rosterIds.length > 0) {
      const { data: rosterPlayers } = await supabase
        .from('roster_players')
        .select('athlete_id, roster_id, athlete_profiles(full_name)')
        .in('roster_id', rosterIds)
        .returns<RosterPlayerRow[]>();

      const seen = new Map<string, AthleteRow>();
      for (const rp of rosterPlayers ?? []) {
        if (seen.has(rp.athlete_id)) continue;
        const teamId = teamByRoster.get(rp.roster_id);
        const divisionId = teamId ? divisionByTeam.get(teamId) : undefined;
        seen.set(rp.athlete_id, {
          id: rp.athlete_id,
          full_name: rp.athlete_profiles?.full_name ?? '—',
          division_id: divisionId ?? '',
        });
      }
      athletes = [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
  }

  const { data: reports } = await supabase
    .from('evaluation_reports')
    .select('id, athlete_id, report_date')
    .eq('coach_id', user!.id)
    .order('report_date', { ascending: false })
    .returns<ReportRow[]>();

  const reportsByAthlete = new Map<string, ReportRow[]>();
  for (const r of reports ?? []) {
    if (!reportsByAthlete.has(r.athlete_id)) reportsByAthlete.set(r.athlete_id, []);
    reportsByAthlete.get(r.athlete_id)!.push(r);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Evaluaciones</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {athletes.map((a) => (
          <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-neutral-900">{a.full_name}</p>
              <a href={`/dashboard/reports/athletes/${a.id}`} className="text-sm text-brand-blue hover:underline">
                Ver perfil
              </a>
            </div>
            {(reportsByAthlete.get(a.id) ?? []).length > 0 && (
              <div className="mt-1 flex flex-col gap-1">
                {(reportsByAthlete.get(a.id) ?? []).map((r) => (
                  <a
                    key={r.id}
                    href={`/dashboard/coach/evaluations/${r.id}/edit`}
                    className="text-sm text-brand-blue hover:underline"
                  >
                    Editar evaluación del {new Date(r.report_date).toLocaleDateString('es-CO')}
                  </a>
                ))}
              </div>
            )}
            <a
              href={`/dashboard/coach/evaluations/new/${a.id}?division_id=${a.division_id}`}
              className="mt-2 inline-block rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
            >
              Nueva evaluación
            </a>
          </div>
        ))}
        {athletes.length === 0 && (
          <p className="text-sm text-neutral-500">
            No tienes deportistas asignados todavía.
          </p>
        )}
      </div>

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
