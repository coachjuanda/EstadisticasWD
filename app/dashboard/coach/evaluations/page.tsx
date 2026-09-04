import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/activeMembership';
import { computeDueStatus } from '@/lib/evaluations/dueStatus';
import { CoachEvaluationsTable, type AthleteEvalRow } from './CoachEvaluationsTable';

type TeamRow = { id: string; name: string; division_id: string };
type RosterRow = { id: string; team_id: string };
type RosterPlayerRow = {
  athlete_id: string;
  roster_id: string;
  athlete_profiles: { full_name: string; position: string | null } | null;
};
type ReportRow = { id: string; athlete_id: string; report_date: string };
type AthleteRowDraft = Omit<AthleteEvalRow, 'dueStatus'>;

export default async function CoachEvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; team_id?: string }>;
}) {
  const { error, team_id: teamFilter } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: coachTeams }, membership] = await Promise.all([
    supabase.from('coach_teams').select('team_id').eq('coach_id', user!.id),
    getActiveMembership(supabase),
  ]);
  const teamIds = (coachTeams ?? []).map((t) => t.team_id);

  const { data: club } = await supabase
    .from('clubs')
    .select('evaluation_deadline')
    .eq('id', membership?.clubId as string)
    .maybeSingle();
  const evaluationDeadline = club?.evaluation_deadline ?? null;

  let rows: AthleteEvalRow[] = [];
  let teamOptions: { id: string; name: string }[] = [];

  if (teamIds.length > 0) {
    const [{ data: teams }, { data: rosters }] = await Promise.all([
      supabase.from('teams').select('id, name, division_id').in('id', teamIds).returns<TeamRow[]>(),
      supabase.from('rosters').select('id, team_id').in('team_id', teamIds).returns<RosterRow[]>(),
    ]);

    const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
    teamOptions = (teams ?? [])
      .map((t) => ({ id: t.id, name: t.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const teamByRoster = new Map((rosters ?? []).map((r) => [r.id, r.team_id]));
    const rosterIds = (rosters ?? []).map((r) => r.id);

    const athletesById = new Map<string, AthleteRowDraft>();

    if (rosterIds.length > 0) {
      const { data: rosterPlayers } = await supabase
        .from('roster_players')
        .select('athlete_id, roster_id, athlete_profiles(full_name, position)')
        .in('roster_id', rosterIds)
        .returns<RosterPlayerRow[]>();

      for (const rp of rosterPlayers ?? []) {
        if (athletesById.has(rp.athlete_id)) continue;
        const teamId = teamByRoster.get(rp.roster_id);
        const team = teamId ? teamById.get(teamId) : undefined;
        athletesById.set(rp.athlete_id, {
          id: rp.athlete_id,
          fullName: rp.athlete_profiles?.full_name ?? '—',
          position: rp.athlete_profiles?.position ?? null,
          teamId: teamId ?? '',
          teamName: team?.name ?? '—',
          divisionId: team?.division_id ?? '',
          lastReportId: null,
          lastReportDate: null,
        });
      }
    }

    const { data: reports } = await supabase
      .from('evaluation_reports')
      .select('id, athlete_id, report_date')
      .eq('coach_id', user!.id)
      .order('report_date', { ascending: false })
      .returns<ReportRow[]>();

    // Ya viene ordenado desc por fecha -- la primera fila que se encuentra
    // por deportista es la evaluación más reciente.
    for (const r of reports ?? []) {
      const athlete = athletesById.get(r.athlete_id);
      if (athlete && !athlete.lastReportId) {
        athlete.lastReportId = r.id;
        athlete.lastReportDate = r.report_date;
      }
    }

    rows = [...athletesById.values()].map((a) => ({
      ...a,
      dueStatus: computeDueStatus(a.lastReportDate, evaluationDeadline),
    }));
    if (teamFilter) rows = rows.filter((a) => a.teamId === teamFilter);
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Evaluaciones</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {evaluationDeadline && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-semibold">Fecha límite de entrega:</span>{' '}
          {new Date(`${evaluationDeadline}T00:00:00`).toLocaleDateString('es-CO', { dateStyle: 'long' })}
        </p>
      )}

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="filter-team">
            Categoría/Equipo
          </label>
          <select
            id="filter-team"
            name="team_id"
            defaultValue={teamFilter ?? ''}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Filtrar
        </button>
        {teamFilter && (
          <a href="/dashboard/coach/evaluations" className="text-sm text-neutral-500 hover:underline">
            Limpiar
          </a>
        )}
      </form>

      <CoachEvaluationsTable athletes={rows} />

      {teamIds.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">No tienes deportistas asignados todavía.</p>
      )}

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
