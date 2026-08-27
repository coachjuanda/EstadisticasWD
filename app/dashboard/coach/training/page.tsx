import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type SessionRow = {
  id: string;
  scheduled_at: string;
  location: string | null;
  training_session_divisions: { divisions: { name: string } | null }[];
  training_attendance: { present: boolean }[];
};

export default async function CoachTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; saved?: string }>;
}) {
  const { error, created, saved } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sessions } = await supabase
    .from('training_sessions')
    .select(
      'id, scheduled_at, location, training_session_divisions(divisions(name)), training_attendance(present)'
    )
    .eq('created_by', user!.id)
    .order('scheduled_at', { ascending: false })
    .returns<SessionRow[]>();

  // Agrupa por mes calendario -- las sesiones ya vienen ordenadas por fecha
  // descendente, así que un solo recorrido en orden basta: cada vez que
  // cambia el mes/año se abre un grupo nuevo, sin necesidad de reordenar.
  type MonthGroup = { key: string; label: string; sessions: SessionRow[] };
  const monthGroups: MonthGroup[] = [];
  for (const s of sessions ?? []) {
    const date = new Date(s.scheduled_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    let group = monthGroups.at(-1);
    if (!group || group.key !== key) {
      const rawLabel = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
      const label = rawLabel.replace(' de ', ' ').replace(/^./, (c) => c.toUpperCase());
      group = { key, label, sessions: [] };
      monthGroups.push(group);
    }
    group.sessions.push(s);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Mis entrenamientos</h1>
        <Link
          href="/dashboard/coach/training/new"
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Nueva sesión
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {created === '1' && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Sesión creada correctamente.</p>
      )}
      {saved === '1' && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Asistencia actualizada.</p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {monthGroups.map((group, idx) => (
          <details
            key={group.key}
            open={idx === 0}
            className="group rounded-xl border border-neutral-200 bg-white"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-neutral-700">{group.label}</h2>
                <span className="text-xs text-neutral-400">
                  {group.sessions.length} sesión{group.sessions.length === 1 ? '' : 'es'}
                </span>
              </div>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <div className="flex flex-col gap-3 px-4 pb-4">
              {group.sessions.map((s) => {
                const divisionNames = s.training_session_divisions
                  .map((d) => d.divisions?.name)
                  .filter(Boolean)
                  .join(', ');
                const total = s.training_attendance.length;
                const present = s.training_attendance.filter((a) => a.present).length;
                const date = new Date(s.scheduled_at);

                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/coach/training/${s.id}`}
                    className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-brand-blue"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-neutral-900">
                        {date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
                        {date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <span className="shrink-0 text-sm text-neutral-500">
                        {present}/{total} presentes
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-500">{divisionNames || 'Sin división'}</p>
                    {s.location && <p className="mt-1 text-xs text-neutral-400">{s.location}</p>}
                  </Link>
                );
              })}
            </div>
          </details>
        ))}
        {(sessions ?? []).length === 0 && (
          <p className="text-sm text-neutral-500">Aún no has registrado sesiones de entrenamiento.</p>
        )}
      </div>

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
