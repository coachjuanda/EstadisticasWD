-- ============================================================================
-- Asistencia de ENTRENADORES a sesiones de entrenamiento -- distinto y más
-- simple que training_attendance (deportistas): acá no hay "convocado" ni
-- cálculo de porcentaje, solo un registro de que tal entrenador estuvo
-- presente en tal sesión. Por eso la tabla no tiene columna `present`: si no
-- hay fila, ese entrenador no estuvo. Sin denominador, no tiene sentido un
-- % de asistencia -- por eso el dashboard de admin solo muestra un conteo
-- absoluto (ver frontend).
--
-- coach_id -> profiles SIN cascade, mismo criterio que training_attendance.
-- athlete_id (es historial real) -- se agrega como razón de bloqueo en
-- deleteUserAction en el mismo commit que esta migración.
--
-- El check "coach_id debe ser un usuario de rol coach" no se puede expresar
-- como check constraint (necesita consultar otra tabla), así que va como
-- trigger BEFORE INSERT/UPDATE, igual que se resolvería en cualquier función
-- SECURITY DEFINER de este esquema.
-- ============================================================================

create table public.training_session_coaches (
  training_session_id uuid not null references public.training_sessions (id) on delete cascade,
  coach_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (training_session_id, coach_id)
);

create index training_session_coaches_coach_id_idx on public.training_session_coaches (coach_id);

create or replace function public.check_training_session_coach_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = new.coach_id and role = 'coach') then
    raise exception 'coach_id debe corresponder a un usuario de rol coach';
  end if;
  return new;
end;
$$;

create trigger trg_training_session_coaches_role_check
before insert or update on public.training_session_coaches
for each row
execute function public.check_training_session_coach_role();

-- ----------------------------------------------------------------------------
-- RLS -- mismo patrón (ya sin recursión) que training_attendance: admin del
-- club o el coach dueño de la sesión pueden gestionar. Ningún coach puede
-- leer el conteo agregado de OTROS coaches -- esta tabla solo es legible
-- sesión por sesión (a través de una sesión que el coach ya puede gestionar),
-- nunca "todas las filas de todos los coaches", así que el ranking del
-- dashboard de admin (que sí necesita leer todas las filas del club) solo lo
-- puede ver el admin.
-- ----------------------------------------------------------------------------

alter table public.training_session_coaches enable row level security;

create policy "training_session_coaches: admin or owning coach manage"
  on public.training_session_coaches for all
  to authenticated
  using (public.can_manage_training_session(training_session_coaches.training_session_id))
  with check (public.can_manage_training_session(training_session_coaches.training_session_id));

grant select, insert, update, delete on public.training_session_coaches to authenticated;

-- ----------------------------------------------------------------------------
-- Vista para el checklist de "entrenadores presentes" al crear/editar una
-- sesión: cualquier coach (no solo el admin) necesita poder listar a los
-- entrenadores ACTIVOS de su club para marcarlos, pero profiles no tiene una
-- policy de "club members read" (se revirtió en la migración 20 por
-- privacidad -- expondría cédula/email de cualquier coach a cualquier
-- coach). Mismo patrón que coach_names: vista reducida (id, full_name) sin
-- security_invoker, para que corra con los privilegios de quien la creó
-- (bypassa RLS de profiles) pero su WHERE sigue acotando por
-- current_user_club_id() del que consulta. A diferencia de coach_names (que
-- muestra el nombre de un coach ya referenciado en historial, activo o no),
-- esta vista filtra status = 'activo' porque es para elegir a quién marcar
-- HOY, no para mostrar un nombre ya guardado.
-- ----------------------------------------------------------------------------

create or replace view public.active_coach_options as
select id, full_name
from public.profiles
where role = 'coach' and status = 'activo' and club_id = public.current_user_club_id();

grant select on public.active_coach_options to authenticated;
revoke all on public.active_coach_options from anon;

-- ----------------------------------------------------------------------------
-- create_training_session -- se agrega p_coach_ids, insertado en la misma
-- transacción implícita que divisiones y asistencia de deportistas (mismo
-- criterio: "un solo submit crea todo"). Se dropea la función porque agregar
-- un parámetro cambia la firma (create or replace exige misma firma).
-- ----------------------------------------------------------------------------

drop function if exists public.create_training_session(timestamptz, text, uuid[], jsonb);

create function public.create_training_session(
  p_scheduled_at timestamptz,
  p_location text,
  p_division_ids uuid[],
  p_attendance jsonb, -- [{"athlete_id": "...", "present": true}, ...]
  p_coach_ids uuid[] -- entrenadores presentes; sin "present": si no está en el array, no estuvo
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_club_id uuid;
  v_session_id uuid;
  v_division_id uuid;
  v_entry jsonb;
  v_coach_id uuid;
begin
  select club_id into v_club_id from public.profiles where id = auth.uid();

  insert into public.training_sessions (club_id, created_by, scheduled_at, location)
  values (v_club_id, auth.uid(), p_scheduled_at, nullif(p_location, ''))
  returning id into v_session_id;

  foreach v_division_id in array p_division_ids loop
    insert into public.training_session_divisions (training_session_id, division_id)
    values (v_session_id, v_division_id);
  end loop;

  for v_entry in select * from jsonb_array_elements(p_attendance) loop
    insert into public.training_attendance (training_session_id, athlete_id, present)
    values (v_session_id, (v_entry ->> 'athlete_id')::uuid, (v_entry ->> 'present')::boolean);
  end loop;

  foreach v_coach_id in array coalesce(p_coach_ids, array[]::uuid[]) loop
    insert into public.training_session_coaches (training_session_id, coach_id)
    values (v_session_id, v_coach_id);
  end loop;

  return v_session_id;
end;
$$;

grant execute on function public.create_training_session(timestamptz, text, uuid[], jsonb, uuid[]) to authenticated;
