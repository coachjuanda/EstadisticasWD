import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAthleteProfile } from '@/lib/reports/athleteProfile';

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });

function monthLabel(month: string) {
  // month viene como "YYYY-MM" -- se ancla al día 2 para evitar corrimientos
  // de zona horaria que muestren el mes anterior.
  const label = MONTH_FORMATTER.format(new Date(`${month}-02T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Arma el query string preservando el deporte activo -- así cambiar de
// torneo o de mes de asistencia nunca hace "saltar" de deporte por accidente.
function buildAthleteQuery(params: { sport?: string | null; tournament_id?: string | null; attendance_month?: string | null }) {
  const qs = new URLSearchParams();
  if (params.sport) qs.set('sport', params.sport);
  if (params.tournament_id) qs.set('tournament_id', params.tournament_id);
  if (params.attendance_month) qs.set('attendance_month', params.attendance_month);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export default async function AthleteProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ sport?: string; tournament_id?: string; attendance_month?: string }>;
}) {
  const { athleteId } = await params;
  const {
    sport: sportFilter,
    tournament_id: tournamentFilter,
    attendance_month: attendanceMonthFilter,
  } = await searchParams;
  const supabase = await createClient();

  const result = await loadAthleteProfile(supabase, athleteId, tournamentFilter, attendanceMonthFilter, sportFilter);
  if (!result.ok) redirect('/dashboard?error=unauthorized');
  const athlete = result.data;

  const exportQuery = buildAthleteQuery({ sport: athlete.selectedSport, tournament_id: athlete.selectedTournamentId });

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

      {athlete.availableSports.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {athlete.availableSports.map((s) => (
            <a
              key={s.sport}
              href={`/dashboard/reports/athletes/${athleteId}${buildAthleteQuery({ sport: s.sport })}`}
              className={
                athlete.selectedSport === s.sport
                  ? 'rounded-full bg-brand-blue px-3 py-1 font-semibold text-white'
                  : 'rounded-full border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-100'
              }
            >
              {s.label}
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <a
          href={`/dashboard/reports/athletes/${athleteId}${buildAthleteQuery({ sport: athlete.selectedSport })}`}
          className={!tournamentFilter ? 'font-semibold text-brand-blue' : 'text-neutral-500 hover:underline'}
        >
          Acumulado
        </a>
        {athlete.tournamentsPlayed.map((t) => (
          <a
            key={t.id}
            href={`/dashboard/reports/athletes/${athleteId}${buildAthleteQuery({ sport: athlete.selectedSport, tournament_id: t.id })}`}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-700">Asistencia a entrenamientos</h2>
            <form method="GET" className="flex items-end gap-2">
              {athlete.selectedSport && <input type="hidden" name="sport" value={athlete.selectedSport} />}
              {tournamentFilter && <input type="hidden" name="tournament_id" value={tournamentFilter} />}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500" htmlFor="attendance-month">
                  Mes
                </label>
                <select
                  id="attendance-month"
                  name="attendance_month"
                  defaultValue={athlete.selectedAttendanceMonth ?? ''}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                >
                  <option value="">Acumulado (todo)</option>
                  {athlete.attendanceMonthOptions.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
              >
                Ver
              </button>
            </form>
          </div>

          {athlete.selectedAttendanceMonth ? (
            <div className="mt-2 flex items-center gap-4 rounded-xl border border-neutral-200 p-4">
              <p className="text-3xl font-bold tabular-nums text-neutral-900">
                {athlete.attendanceMonthPct !== null ? `${athlete.attendanceMonthPct}%` : '—'}
              </p>
              <p className="text-sm text-neutral-500">
                {athlete.attendanceMonthTotal > 0
                  ? `${athlete.attendanceMonthPresent} de ${athlete.attendanceMonthTotal} convocatorias en ${monthLabel(athlete.selectedAttendanceMonth)}`
                  : `Sin convocatorias en ${monthLabel(athlete.selectedAttendanceMonth)}`}
              </p>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-4 rounded-xl border border-neutral-200 p-4">
              <p className="text-3xl font-bold tabular-nums text-neutral-900">{athlete.attendancePct}%</p>
              <p className="text-sm text-neutral-500">
                {athlete.attendancePresent} de {athlete.attendanceTotal} convocatorias (acumulado)
              </p>
            </div>
          )}
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
