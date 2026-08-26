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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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

      <div className="mt-6 flex flex-col gap-3">
        {(sessions ?? []).map((s) => {
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
        {(sessions ?? []).length === 0 && (
          <p className="text-sm text-neutral-500">Aún no has registrado sesiones de entrenamiento.</p>
        )}
      </div>
    </div>
  );
}
