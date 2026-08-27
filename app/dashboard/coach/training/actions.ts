'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/coach/training';

async function requireCoach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'coach') redirect('/dashboard?error=unauthorized');

  return { supabase, coachId: user.id };
}

export type CreateTrainingSessionState =
  | { status: 'idle' }
  | { status: 'error'; message: string };

export async function createTrainingSessionAction(
  _prevState: CreateTrainingSessionState,
  formData: FormData
): Promise<CreateTrainingSessionState> {
  const { supabase } = await requireCoach();

  const scheduledDate = formData.get('scheduled_date') as string;
  const scheduledTime = formData.get('scheduled_time') as string;
  const location = (formData.get('location') as string)?.trim();
  const divisionIdsRaw = formData.get('division_ids') as string;
  const attendanceRaw = formData.get('attendance') as string;
  const coachIdsRaw = formData.get('coach_ids') as string;

  if (!scheduledDate || !scheduledTime) {
    return { status: 'error', message: 'Fecha y hora son obligatorias.' };
  }

  let divisionIds: string[] = [];
  let attendance: { athlete_id: string; present: boolean }[] = [];
  let coachIds: string[] = [];
  try {
    divisionIds = JSON.parse(divisionIdsRaw || '[]');
    attendance = JSON.parse(attendanceRaw || '[]');
    coachIds = JSON.parse(coachIdsRaw || '[]');
  } catch {
    return { status: 'error', message: 'Datos de formulario inválidos.' };
  }

  if (divisionIds.length === 0) {
    return { status: 'error', message: 'Elige al menos una división.' };
  }
  if (attendance.length === 0) {
    return { status: 'error', message: 'No hay deportistas convocados para esas divisiones.' };
  }

  const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

  const { error } = await supabase.rpc('create_training_session', {
    p_scheduled_at: scheduledAt,
    p_location: location || null,
    p_division_ids: divisionIds,
    p_attendance: attendance,
    p_coach_ids: coachIds,
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?created=1`);
}

export type UpdateAttendanceState =
  | { status: 'idle' }
  | { status: 'error'; message: string };

export async function updateTrainingAttendanceAction(
  _prevState: UpdateAttendanceState,
  formData: FormData
): Promise<UpdateAttendanceState> {
  const { supabase } = await requireCoach();

  const sessionId = formData.get('session_id') as string;
  const attendanceRaw = formData.get('attendance') as string;
  const coachIdsRaw = formData.get('coach_ids') as string;

  let attendance: { id: string; present: boolean }[] = [];
  let coachIds: string[] = [];
  try {
    attendance = JSON.parse(attendanceRaw || '[]');
    coachIds = JSON.parse(coachIdsRaw || '[]');
  } catch {
    return { status: 'error', message: 'Datos de formulario inválidos.' };
  }

  for (const row of attendance) {
    const { error } = await supabase
      .from('training_attendance')
      .update({ present: row.present })
      .eq('id', row.id);

    if (error) {
      return { status: 'error', message: error.message };
    }
  }

  // Sin columna "present" en training_session_coaches (ver migración): se
  // reemplaza el set completo -- borrar todo y volver a insertar los
  // marcados es más simple que calcular el diff, y el volumen por sesión es
  // trivial (unos pocos entrenadores).
  const { error: deleteCoachesError } = await supabase
    .from('training_session_coaches')
    .delete()
    .eq('training_session_id', sessionId);

  if (deleteCoachesError) {
    return { status: 'error', message: deleteCoachesError.message };
  }

  if (coachIds.length > 0) {
    const { error: insertCoachesError } = await supabase
      .from('training_session_coaches')
      .insert(coachIds.map((coach_id) => ({ training_session_id: sessionId, coach_id })));

    if (insertCoachesError) {
      return { status: 'error', message: insertCoachesError.message };
    }
  }

  revalidatePath(`${BASE_PATH}/${sessionId}`);
  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?saved=1`);
}
