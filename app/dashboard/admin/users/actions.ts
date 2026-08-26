'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTempPassword } from '@/lib/generate-password';
import { validateManualPassword } from '@/lib/password-policy';

const BASE_PATH = '/dashboard/admin/users';

// Estas acciones usan la service_role key (vía createAdminClient) para crear
// usuarios y resetear contraseñas -- eso bypassa RLS por completo, así que a
// diferencia del resto del admin (donde RLS ya hace de guardia), acá SÍ hay
// que verificar rol admin a mano en cada acción antes de tocar nada
// privilegiado.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/dashboard?error=unauthorized');

  return { supabase, clubId: profile.club_id as string, adminId: user.id };
}

// Resuelve la contraseña a usar según el modo elegido por el admin -- nunca
// se loguea ni se guarda en ningún lado más allá de pasarla directo a la
// Admin API de Supabase Auth (que la hashea internamente).
function resolvePassword(formData: FormData): { password: string } | { error: string } {
  const mode = formData.get('password_mode') as string;

  if (mode === 'manual') {
    const password = (formData.get('password') as string) ?? '';
    const confirm = (formData.get('password_confirm') as string) ?? '';

    if (password !== confirm) {
      return { error: 'Las contraseñas no coinciden.' };
    }

    const validationError = validateManualPassword(password);
    if (validationError) {
      return { error: validationError };
    }

    return { password };
  }

  return { password: generateTempPassword() };
}

function friendlyAuthError(message: string) {
  if (message.toLowerCase().includes('already been registered') || message.toLowerCase().includes('already registered')) {
    return 'Ya existe un usuario con ese email.';
  }
  if (message.toLowerCase().includes('cedula') || message.toLowerCase().includes('duplicate key')) {
    return 'Ya existe un usuario con esa cédula.';
  }
  return message;
}

export type CreateUserState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; passwordMode: 'auto'; password: string; fullName: string; cedula: string; email: string; role: string }
  | { status: 'success'; passwordMode: 'manual'; fullName: string; cedula: string; email: string; role: string };

export async function createUserAction(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const { supabase, clubId } = await requireAdmin();

  const full_name = (formData.get('full_name') as string)?.trim();
  const cedula = (formData.get('cedula') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();
  const role = formData.get('role') as string;
  const position = formData.get('position') as string;
  const team_ids = formData.getAll('team_ids') as string[];

  if (!full_name || !cedula || !email || !role) {
    return { status: 'error', message: 'Nombre, cédula, email y rol son obligatorios.' };
  }

  const passwordResult = resolvePassword(formData);
  if ('error' in passwordResult) {
    return { status: 'error', message: passwordResult.error };
  }
  const { password } = passwordResult;
  const passwordMode = (formData.get('password_mode') as string) === 'manual' ? 'manual' : 'auto';
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { club_id: clubId, role, full_name, cedula },
  });

  if (error) {
    return { status: 'error', message: friendlyAuthError(error.message) };
  }

  if (role === 'coach' && team_ids.length > 0) {
    const { error: assignError } = await supabase
      .from('coach_teams')
      .insert(team_ids.map((team_id) => ({ coach_id: created.user.id, team_id })));

    if (assignError) {
      return {
        status: 'error',
        message: `Usuario creado, pero falló asignar equipos: ${assignError.message}`,
      };
    }
  }

  // handle_new_athlete_profile ya creó la fila de athlete_profiles (sin
  // posición); acá solo la completamos.
  if (role === 'deportista' && position) {
    const { error: positionError } = await supabase
      .from('athlete_profiles')
      .update({ position })
      .eq('id', created.user.id);

    if (positionError) {
      return {
        status: 'error',
        message: `Usuario creado, pero falló guardar la posición: ${positionError.message}`,
      };
    }
  }

  revalidatePath(BASE_PATH);
  return passwordMode === 'manual'
    ? { status: 'success', passwordMode: 'manual', fullName: full_name, cedula, email, role }
    : { status: 'success', passwordMode: 'auto', password, fullName: full_name, cedula, email, role };
}

export type ResetPasswordState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; passwordMode: 'auto'; password: string }
  | { status: 'success'; passwordMode: 'manual' };

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  await requireAdmin();

  const userId = formData.get('user_id') as string;
  if (!userId) {
    return { status: 'error', message: 'Falta el usuario.' };
  }

  const passwordResult = resolvePassword(formData);
  if ('error' in passwordResult) {
    return { status: 'error', message: passwordResult.error };
  }
  const { password } = passwordResult;
  const passwordMode = (formData.get('password_mode') as string) === 'manual' ? 'manual' : 'auto';

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return passwordMode === 'manual' ? { status: 'success', passwordMode: 'manual' } : { status: 'success', passwordMode: 'auto', password };
}

export async function updateUser(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = formData.get('id') as string;
  const full_name = (formData.get('full_name') as string)?.trim();
  const role = formData.get('role') as string;
  const status = formData.get('status') as string;
  const position = formData.get('position') as string;

  if (!id || !full_name || !role || !status) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Datos incompletos.')}`);
  }

  const { error } = await supabase.from('profiles').update({ full_name, role, status }).eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  // athlete_profiles.full_name se copió de profiles.full_name solo una vez,
  // al crear la cuenta (handle_new_athlete_profile) -- sin este sync, un
  // cambio de nombre acá nunca se reflejaría en nóminas, partidos ni la
  // vista pública, que siempre leen de athlete_profiles.
  if (role === 'deportista') {
    const { error: athleteError } = await supabase
      .from('athlete_profiles')
      .update({ full_name, ...(position ? { position } : {}) })
      .eq('id', id);

    if (athleteError) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(athleteError.message)}`);
    }
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

const ROLE_SUBJECT_LABELS: Record<string, string> = {
  deportista: 'Este deportista',
  coach: 'Este coach',
  scorekeeper: 'Este scorekeeper',
  admin: 'Este usuario',
};

// Varias tablas apuntan a profiles/athlete_profiles sin ON DELETE CASCADE a
// propósito (match_player_stats, evaluation_reports, survey_responses,
// matches.scorekeeper_id, stat_audit_log.changed_by, survey_templates.created_by)
// -- son historial real, borrar el usuario no debe borrar silenciosamente ni
// romper esa trazabilidad. Esta función junta, por rol, todas las razones por
// las que NO se puede borrar; si devuelve un array vacío, es seguro borrar.
async function getDeletionBlockReasons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: { id: string; role: string }
): Promise<string[]> {
  const reasons: string[] = [];

  if (target.role === 'deportista') {
    const [{ count: statsCount }, { count: evalCount }, { count: surveyCount }, { count: attendanceCount }] = await Promise.all([
      supabase.from('match_player_stats').select('id', { count: 'exact', head: true }).eq('athlete_id', target.id),
      supabase.from('evaluation_reports').select('id', { count: 'exact', head: true }).eq('athlete_id', target.id),
      supabase.from('survey_responses').select('id', { count: 'exact', head: true }).eq('user_id', target.id),
      supabase.from('training_attendance').select('id', { count: 'exact', head: true }).eq('athlete_id', target.id),
    ]);
    if ((statsCount ?? 0) > 0) {
      reasons.push(`tiene estadísticas registradas en ${statsCount} partido${statsCount === 1 ? '' : 's'}`);
    }
    if ((evalCount ?? 0) > 0) {
      reasons.push(
        `tiene ${evalCount} evaluación${evalCount === 1 ? '' : 'es'} técnica${evalCount === 1 ? '' : 's'} registrada${evalCount === 1 ? '' : 's'}`
      );
    }
    if ((surveyCount ?? 0) > 0) {
      reasons.push(`respondió ${surveyCount} encuesta${surveyCount === 1 ? '' : 's'}`);
    }
    if ((attendanceCount ?? 0) > 0) {
      reasons.push(`tiene ${attendanceCount} registro${attendanceCount === 1 ? '' : 's'} de asistencia a entrenamientos`);
    }
  }

  if (target.role === 'coach') {
    const [{ count }, { count: sessionsCount }] = await Promise.all([
      supabase.from('evaluation_reports').select('id', { count: 'exact', head: true }).eq('coach_id', target.id),
      supabase.from('training_sessions').select('id', { count: 'exact', head: true }).eq('created_by', target.id),
    ]);
    if ((count ?? 0) > 0) {
      reasons.push(`escribió ${count} evaluación${count === 1 ? '' : 'es'} técnica${count === 1 ? '' : 's'}`);
    }
    if ((sessionsCount ?? 0) > 0) {
      reasons.push(`creó ${sessionsCount} sesión${sessionsCount === 1 ? '' : 'es'} de entrenamiento`);
    }
  }

  if (target.role === 'scorekeeper') {
    const { data: matches } = await supabase.from('matches').select('status').eq('scorekeeper_id', target.id);
    const total = matches?.length ?? 0;
    if (total > 0) {
      const liveOrDone = (matches ?? []).filter((m) => m.status !== 'programado').length;
      reasons.push(
        liveOrDone > 0
          ? `tiene ${total} partido${total === 1 ? '' : 's'} asignado${total === 1 ? '' : 's'} (${liveOrDone} en vivo o finalizado${liveOrDone === 1 ? '' : 's'})`
          : `tiene ${total} partido${total === 1 ? '' : 's'} programado${total === 1 ? '' : 's'} asignado${total === 1 ? '' : 's'} -- reasígnalo(s) a otro scorekeeper desde Partidos`
      );
    }
  }

  // Catch-all para cualquier rol: si alguna vez corrigió una estadística
  // (queda en el historial de auditoría), creó una plantilla de encuesta, o
  // creó una sesión de entrenamiento (esto último ya se chequea arriba para
  // coach, pero un admin también puede crear sesiones).
  const [{ count: auditCount }, { count: templatesCount }, { count: adminSessionsCount }] = await Promise.all([
    supabase.from('stat_audit_log').select('id', { count: 'exact', head: true }).eq('changed_by', target.id),
    supabase.from('survey_templates').select('id', { count: 'exact', head: true }).eq('created_by', target.id),
    target.role === 'admin'
      ? supabase.from('training_sessions').select('id', { count: 'exact', head: true }).eq('created_by', target.id)
      : Promise.resolve({ count: 0 }),
  ]);
  if ((auditCount ?? 0) > 0) {
    reasons.push('aparece en el historial de auditoría de estadísticas (hizo correcciones registradas)');
  }
  if ((templatesCount ?? 0) > 0) {
    reasons.push(`creó ${templatesCount} plantilla${templatesCount === 1 ? '' : 's'} de encuesta`);
  }
  if ((adminSessionsCount ?? 0) > 0) {
    reasons.push(`creó ${adminSessionsCount} sesión${adminSessionsCount === 1 ? '' : 'es'} de entrenamiento`);
  }

  return reasons;
}

export async function deleteUserAction(formData: FormData) {
  const { supabase, clubId, adminId } = await requireAdmin();

  const userId = formData.get('id') as string;
  if (!userId) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Falta el usuario.')}`);
  }

  if (userId === adminId) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('No puedes eliminar tu propia cuenta.')}`);
  }

  const { data: target } = await supabase.from('profiles').select('id, role').eq('id', userId).single();
  if (!target) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Usuario no encontrado.')}`);
  }

  if (target.role === 'admin') {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent('No puedes eliminar al único administrador del club -- el club siempre necesita al menos uno.')}`);
    }
  }

  const reasons = await getDeletionBlockReasons(supabase, target);
  if (reasons.length > 0) {
    const subject = ROLE_SUBJECT_LABELS[target.role] ?? 'Este usuario';
    const message = `${subject} ${reasons.join(' y ')}, no se puede eliminar. Puedes desactivarlo en su lugar desde "Editar" → Estado: inactivo, lo cual le quita el acceso sin perder el historial.`;
    redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
  }

  // roster_players.athlete_id no tiene ON DELETE CASCADE (a propósito, para
  // que borrar un equipo no arrastre deportistas) -- pero estar en una
  // nómina sin haber jugado no cuenta como "dato real" para este chequeo, así
  // que se limpia acá antes de borrar, solo una vez ya se confirmó que no hay
  // nada bloqueante.
  if (target.role === 'deportista') {
    await supabase.from('roster_players').delete().eq('athlete_id', userId);
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent('No se pudo eliminar: tiene datos relacionados que lo impiden. Considera desactivarlo en su lugar.')}`
    );
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function assignCoachTeams(formData: FormData) {
  const { supabase } = await requireAdmin();

  const coachId = formData.get('coach_id') as string;
  const teamIds = formData.getAll('team_ids') as string[];

  if (!coachId) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Falta el coach.')}`);
  }

  const { error: deleteError } = await supabase.from('coach_teams').delete().eq('coach_id', coachId);
  if (deleteError) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(deleteError.message)}`);
  }

  if (teamIds.length > 0) {
    const { error: insertError } = await supabase
      .from('coach_teams')
      .insert(teamIds.map((team_id) => ({ coach_id: coachId, team_id })));

    if (insertError) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(insertError.message)}`);
    }
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
