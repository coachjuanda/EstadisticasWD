import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAthleteProfile } from '@/lib/reports/athleteProfile';

export default async function AthleteProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ tournament_id?: string }>;
}) {
  const { athleteId } = await params;
  const { tournament_id: tournamentFilter } = await searchParams;
  const supabase = await createClient();

  const result = await loadAthleteProfile(supabase, athleteId, tournamentFilter);
  if (!result.ok) redirect('/dashboard?error=unauthorized');
  const athlete = result.data;

  const exportQuery = tournamentFilter ? `?tournament_id=${tournamentFilter}` : '';

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">{athlete.fullName}</h1>
        <div className="flex gap-2">
          <a
            href={`/api/reports/athletes/${athleteId}/pdf${exportQuery}`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Descargar PDF
          </a>
          <a
            href={`/api/reports/athletes/${athleteId}/excel${exportQuery}`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Descargar Excel
          </a>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {athlete.positionLabel}
        {athlete.teams.length > 0 && (
          <>
            {' · '}
            {athlete.teams.join(', ')}
          </>
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a
          href={`/dashboard/reports/athletes/${athleteId}`}
          className={!tournamentFilter ? 'font-semibold text-brand-blue' : 'text-neutral-500 hover:underline'}
        >
          Acumulado (toda su historia)
        </a>
        {athlete.tournamentsPlayed.map((t) => (
          <a
            key={t.id}
            href={`/dashboard/reports/athletes/${athleteId}?tournament_id=${t.id}`}
            className={tournamentFilter === t.id ? 'font-semibold text-brand-blue' : 'text-neutral-500 hover:underline'}
          >
            {t.name}
          </a>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {athlete.statCards.map((s) => (
          <div key={s.key} className="rounded-xl border border-neutral-200 p-3 text-center">
            <p className="text-xs text-neutral-500">{s.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{s.value}</p>
          </div>
        ))}
        {athlete.matchesInScope === 0 && (
          <p className="col-span-full text-sm text-neutral-500">Sin partidos registrados en esta vista.</p>
        )}
      </div>

      {athlete.attendancePct !== null && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-700">Asistencia a entrenamientos</h2>
          <div className="mt-2 flex items-center gap-4 rounded-xl border border-neutral-200 p-4">
            <p className="text-3xl font-bold tabular-nums text-neutral-900">{athlete.attendancePct}%</p>
            <p className="text-sm text-neutral-500">
              {athlete.attendancePresent} de {athlete.attendanceTotal} convocatorias
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            {athlete.recentTrainingSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
              >
                <span className="text-neutral-700">
                  {new Date(s.scheduledAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  {s.divisionNames && ` · ${s.divisionNames}`}
                </span>
                <span className={s.present ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                  {s.present ? 'Presente' : 'Ausente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {athlete.teamMemberships.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-700">Resumen de equipo</h2>
          <div className="mt-2 flex flex-col gap-2">
            {athlete.teamMemberships.map((m) => (
              <div
                key={m.rosterId}
                className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm"
              >
                <span>
                  {m.teamName} · {m.tournamentName}
                </span>
                <a
                  href={`/dashboard/team-stats/${m.teamId}?tournament_id=${m.tournamentId}`}
                  className="text-brand-blue hover:underline"
                >
                  Dashboard →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
