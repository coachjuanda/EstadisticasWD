-- ============================================================================
-- FIX -- las policies de training_sessions/training_session_divisions/
-- training_attendance se referencian en círculo: "training_sessions: athlete
-- reads own attendance sessions" subconsulta training_attendance, y
-- "training_attendance: admin/coach" subconsulta training_sessions. Postgres
-- evalúa TODAS las policies del set (no solo la del rol actual), así que
-- consultar cualquiera de las dos tablas dispara "infinite recursion
-- detected in policy" -- mismo patrón que ya se había resuelto antes para
-- profiles/athlete_profiles (ver migración 14). El fix es el mismo: mover el
-- chequeo cruzado a una función SECURITY DEFINER, que bypassa RLS de la
-- tabla que consulta y así no re-dispara el ciclo.
-- ============================================================================

create or replace function public.can_manage_training_session(p_session_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.training_sessions ts
    where ts.id = p_session_id
      and (
        (public.current_user_role() = 'admin' and ts.club_id = public.current_user_club_id())
        or (public.current_user_role() = 'coach' and ts.created_by = auth.uid())
      )
  );
$$;

create or replace function public.athlete_has_training_attendance(p_session_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.training_attendance ta
    where ta.training_session_id = p_session_id
      and ta.athlete_id = auth.uid()
  );
$$;

-- training_sessions: la policy de admin y de coach no recursan (no
-- consultan training_attendance), solo se reemplaza la del deportista.
drop policy "training_sessions: athlete reads own attendance sessions" on public.training_sessions;

create policy "training_sessions: athlete reads own attendance sessions"
  on public.training_sessions for select
  to authenticated
  using (
    public.current_user_role() = 'deportista'
    and public.athlete_has_training_attendance(training_sessions.id)
  );

-- training_session_divisions: las dos policies recursaban (una vía
-- training_sessions, la otra vía training_attendance) -- se reemplazan
-- ambas por las funciones.
drop policy "training_session_divisions: admin or owning coach write" on public.training_session_divisions;
drop policy "training_session_divisions: athlete reads own attendance sessions" on public.training_session_divisions;

create policy "training_session_divisions: admin or owning coach write"
  on public.training_session_divisions for all
  to authenticated
  using (public.can_manage_training_session(training_session_divisions.training_session_id))
  with check (public.can_manage_training_session(training_session_divisions.training_session_id));

create policy "training_session_divisions: athlete reads own attendance sessions"
  on public.training_session_divisions for select
  to authenticated
  using (public.athlete_has_training_attendance(training_session_divisions.training_session_id));

-- training_attendance: admin + coach se funden en una sola policy sobre la
-- función (antes eran dos policies separadas, cada una con su propia
-- subconsulta recursiva a training_sessions). La de "athlete reads own" no
-- tocaba training_sessions, así que no recursaba y se deja igual.
drop policy "training_attendance: admin full access" on public.training_attendance;
drop policy "training_attendance: coach manages own sessions" on public.training_attendance;

create policy "training_attendance: admin or owning coach manage"
  on public.training_attendance for all
  to authenticated
  using (public.can_manage_training_session(training_attendance.training_session_id))
  with check (public.can_manage_training_session(training_attendance.training_session_id));
