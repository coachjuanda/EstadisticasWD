import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EditAttendanceForm } from './EditAttendanceForm';

type SessionRow = {
  id: string;
  scheduled_at: string;
  location: string | null;
  training_session_divisions: { divisions: { name: string } | null }[];
};

type AttendanceRow = {
  id: string;
  athlete_id: string;
  present: boolean;
  athlete_profiles: { full_name: string } | null;
};

export default async function TrainingSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { sessionId } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('training_sessions')
    .select('id, scheduled_at, location, training_session_divisions(divisions(name))')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>();

  if (!session) {
    notFound();
  }

  const { data: attendance } = await supabase
    .from('training_attendance')
    .select('id, athlete_id, present, athlete_profiles(full_name)')
    .eq('training_session_id', sessionId)
    .returns<AttendanceRow[]>();

  const athletes = (attendance ?? [])
    .map((a) => ({ id: a.id, full_name: a.athlete_profiles?.full_name ?? '—', present: a.present }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const divisionNames = session.training_session_divisions
    .map((d) => d.divisions?.name)
    .filter(Boolean)
    .join(', ');
  const date = new Date(session.scheduled_at);

  // Key atado al contenido real de la asistencia: fuerza a remontar el
  // formulario (y por tanto reinicializar su estado desde el prop fresco)
  // cada vez que los datos guardados cambian -- sin esto, el reset nativo
  // del <form> que dispara un server action en React 19 desincroniza el
  // checkbox recién tocado del checked real en el DOM tras guardar.
  const attendanceKey = athletes.map((a) => `${a.id}:${a.present}`).join('|');

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">
        {date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
        {date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">{divisionNames || 'Sin división'}</p>
      {session.location && <p className="text-sm text-neutral-500">{session.location}</p>}

      {saved === '1' && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Asistencia actualizada.</p>
      )}

      <div className="mt-6">
        <EditAttendanceForm key={attendanceKey} sessionId={session.id} athletes={athletes} />
      </div>
    </div>
  );
}
