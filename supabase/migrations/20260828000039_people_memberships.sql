-- ============================================================================
-- GRUPO — multi-rol / multi-club: reemplaza "profiles" (persona = 1 rol en 1
-- club) por "people" (identidad) + "memberships" (persona × club × rol, N:N).
-- Diseñado para poder cubrir después multi-club con la misma estructura, sin
-- reescribirla -- hoy solo hay 1 club, así que memberships.club_id siempre
-- vale lo mismo para todas las membresías de una persona, pero la tabla ya
-- soporta que no sea así.
--
-- current_user_role()/current_user_club_id() (usadas en TODAS las policies
-- del esquema) pasan a resolver la "membresía activa" de la sesión --
-- people.active_membership_id -- así que ninguna policy existente necesita
-- tocarse: el cambio queda encapsulado en la implementación de esas dos
-- funciones. Las excepciones son las policies que consultaban `profiles`
-- DIRECTO (no a través de esas funciones) -- esas sí se redefinen abajo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- people -- identidad de la persona (antes: profiles, sin club_id/role)
-- ----------------------------------------------------------------------------

create table public.people (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  cedula text not null unique,
  status public.user_status not null default 'activo',
  active_membership_id uuid
);

insert into public.people (id, full_name, email, cedula, status)
select id, full_name, email, cedula, status from public.profiles;

-- ----------------------------------------------------------------------------
-- memberships -- cada rol que una persona ejerce, en un club
-- ----------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  club_id uuid not null references public.clubs (id),
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (person_id, club_id, role)
);

insert into public.memberships (person_id, club_id, role)
select id, club_id, role from public.profiles;

alter table public.people
  add constraint people_active_membership_id_fkey
  foreign key (active_membership_id) references public.memberships (id) on delete set null;

-- Cada persona existente tiene exactamente 1 membership recién creada (1:1
-- con su fila de profiles) -- se activa automáticamente. Nadie ve un selector
-- de rol hasta que tenga una segunda membership.
update public.people p
set active_membership_id = m.id
from public.memberships m
where m.person_id = p.id;

create index memberships_person_id_idx on public.memberships (person_id);

-- ----------------------------------------------------------------------------
-- current_user_role() / current_user_club_id() -- mismo nombre y firma,
-- ahora resuelven vía people.active_membership_id -> memberships. Punto
-- único de cambio para las ~20 migraciones que ya las usan.
-- ----------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select m.role
  from public.people p
  join public.memberships m on m.id = p.active_membership_id
  where p.id = auth.uid();
$$;

create or replace function public.current_user_club_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select m.club_id
  from public.people p
  join public.memberships m on m.id = p.active_membership_id
  where p.id = auth.uid();
$$;

-- profile_in_my_club() -- ya la usaba "athlete_profiles: club members read".
-- Antes comparaba profiles.club_id (1 solo); ahora "pertenece a mi club" es
-- "tiene AL MENOS una membership en mi club", sin importar cuál tenga activa
-- en este momento (si soy coach+deportista y ahora mismo entré como coach,
-- sigo apareciendo como miembro del club para efectos de este check).
create or replace function public.profile_in_my_club(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.person_id = p_profile_id
      and m.club_id = public.current_user_club_id()
  );
$$;

-- ----------------------------------------------------------------------------
-- set_active_membership() -- cambia el rol activo de la sesión, sin re-login.
-- Usada tanto por el selector de rol al login (cuando hay >1 membership)
-- como por el switcher dentro del dashboard. SECURITY DEFINER para poder
-- escribir people.active_membership_id sin necesitar una policy de
-- self-update de fila completa en people (que abriría también full_name/
-- status/cedula a auto-edición, igual al motivo por el que athlete_profiles
-- restringe su self-update a nivel de frontend, no de columna).
-- ----------------------------------------------------------------------------

create or replace function public.set_active_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.memberships
    where id = p_membership_id and person_id = auth.uid()
  ) then
    raise exception 'No tienes ese rol asignado.';
  end if;

  update public.people set active_membership_id = p_membership_id where id = auth.uid();
end;
$$;

grant execute on function public.set_active_membership(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- handle_new_user() -- ahora crea people + su primera membership (en vez de
-- 1 fila de profiles). Misma firma, mismo trigger en auth.users, mismo
-- user_metadata (club_id/role/full_name/cedula) que ya manda el Admin API al
-- crear el usuario -- bootstrap-admin.mjs y createUserAction no cambian.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
begin
  insert into public.people (id, full_name, email, cedula, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'cedula',
    'activo'
  );

  insert into public.memberships (person_id, club_id, role)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'club_id')::uuid,
    (new.raw_user_meta_data ->> 'role')::public.user_role
  )
  returning id into v_membership_id;

  update public.people set active_membership_id = v_membership_id where id = new.id;

  return new;
end;
$$;

-- handle_new_athlete_profile() -- antes disparaba "after insert on profiles"
-- (una persona = un rol al crearse). Ahora "ser deportista" es un hecho de
-- membership, no de la creación de la persona -- se mueve el trigger a
-- "after insert on memberships", así también cubre el caso futuro de
-- agregarle a alguien existente un segundo rol "deportista".
create or replace function public.handle_new_athlete_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'deportista' then
    insert into public.athlete_profiles (id, full_name)
    select p.id, p.full_name
    from public.people p
    where p.id = new.person_id
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_handle_new_athlete_profile
after insert on public.memberships
for each row
execute function public.handle_new_athlete_profile();

-- check_training_session_coach_role(): mismo check, ahora contra memberships.
create or replace function public.check_training_session_coach_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.memberships where person_id = new.coach_id and role = 'coach') then
    raise exception 'coach_id debe corresponder a un usuario de rol coach';
  end if;
  return new;
end;
$$;

-- create_training_session() / create_tournament_with_config(): solo cambia
-- cómo resuelven v_club_id (ahora vía current_user_club_id(), ya redefinida
-- arriba -- antes leían profiles.club_id inline). Mismas firmas.
create or replace function public.create_training_session(
  p_scheduled_at timestamptz,
  p_location text,
  p_division_ids uuid[],
  p_attendance jsonb,
  p_coach_ids uuid[]
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
  v_club_id := public.current_user_club_id();

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

create or replace function public.create_tournament_with_config(
  p_name text,
  p_league_id uuid,
  p_start_date date,
  p_end_date date,
  p_division_ids uuid[],
  p_stat_definition_ids uuid[]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_club_id uuid;
  v_tournament_id uuid;
  v_division_id uuid;
  v_stat_id uuid;
begin
  v_club_id := public.current_user_club_id();

  insert into public.tournaments (club_id, league_id, name, start_date, end_date)
  values (v_club_id, p_league_id, p_name, p_start_date, p_end_date)
  returning id into v_tournament_id;

  foreach v_division_id in array p_division_ids loop
    insert into public.tournament_divisions (tournament_id, division_id)
    values (v_tournament_id, v_division_id);
  end loop;

  foreach v_stat_id in array p_stat_definition_ids loop
    insert into public.tournament_stat_config (tournament_id, stat_definition_id, enabled)
    values (v_tournament_id, v_stat_id, true);
  end loop;

  return v_tournament_id;
end;
$$;

-- active_coach_options / coach_names: mismo shape (id, full_name), ahora
-- vía people+memberships. Sin security_invoker (igual que antes): corren con
-- los privilegios de quien las creó, bypassando RLS de people/memberships,
-- pero su propio WHERE sigue acotando por current_user_club_id() de quien
-- consulta.
create or replace view public.active_coach_options as
select p.id, p.full_name
from public.people p
join public.memberships m on m.person_id = p.id
where m.role = 'coach' and p.status = 'activo' and m.club_id = public.current_user_club_id();

create or replace view public.coach_names as
select p.id, p.full_name
from public.people p
join public.memberships m on m.person_id = p.id
where m.role = 'coach' and m.club_id = public.current_user_club_id();

grant select on public.active_coach_options to authenticated;
revoke all on public.active_coach_options from anon;
grant select on public.coach_names to authenticated;
revoke all on public.coach_names from anon;

-- ----------------------------------------------------------------------------
-- RLS -- people (reemplaza a profiles: self read + admin read/update own
-- club). Sin policy de insert/delete (igual que profiles: altas y bajas
-- pasan por Supabase Auth, nunca por INSERT/DELETE directo). Sin policy de
-- self-update: el único self-update real (cambiar de rol activo) pasa por
-- set_active_membership(), no por UPDATE directo a la tabla.
-- ----------------------------------------------------------------------------

alter table public.people enable row level security;

create policy "people: self read"
  on public.people for select
  to authenticated
  using (id = auth.uid());

create policy "people: admin reads own club"
  on public.people for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and public.profile_in_my_club(id)
  );

create policy "people: admin updates own club"
  on public.people for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and public.profile_in_my_club(id)
  )
  with check (
    public.current_user_role() = 'admin'
    and public.profile_in_my_club(id)
  );

grant select, update on public.people to authenticated;

-- ----------------------------------------------------------------------------
-- RLS -- memberships. Self read (para que el selector de login y el
-- switcher del dashboard puedan listar los roles propios) + admin gestiona
-- las del propio club (mismo patrón que cualquier otra tabla club-scoped;
-- sin UI todavía que la use para asignar un segundo rol, pero la policy ya
-- queda lista para eso).
-- ----------------------------------------------------------------------------

alter table public.memberships enable row level security;

create policy "memberships: self read"
  on public.memberships for select
  to authenticated
  using (person_id = auth.uid());

create policy "memberships: admin manages own club"
  on public.memberships for all
  to authenticated
  using (public.current_user_role() = 'admin' and club_id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and club_id = public.current_user_club_id());

grant select, insert, update, delete on public.memberships to authenticated;

-- ----------------------------------------------------------------------------
-- Policies que consultaban `public.profiles` DIRECTO (no vía
-- current_user_role()/current_user_club_id()) -- se redefinen para usar
-- profile_in_my_club() en vez del subquery inline contra profiles.
-- ----------------------------------------------------------------------------

drop policy "athlete_profiles: admin full access" on public.athlete_profiles;
create policy "athlete_profiles: admin full access"
  on public.athlete_profiles for all
  to authenticated
  using (public.current_user_role() = 'admin' and public.profile_in_my_club(id))
  with check (public.current_user_role() = 'admin' and public.profile_in_my_club(id));

drop policy "evaluation_reports: admin full access" on public.evaluation_reports;
create policy "evaluation_reports: admin full access"
  on public.evaluation_reports for all
  to authenticated
  using (public.current_user_role() = 'admin' and public.profile_in_my_club(athlete_id))
  with check (public.current_user_role() = 'admin' and public.profile_in_my_club(athlete_id));

drop policy "evaluation_scores: admin or owning coach write" on public.evaluation_scores;
create policy "evaluation_scores: admin or owning coach write"
  on public.evaluation_scores for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_scores.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_scores: admin or owning coach update" on public.evaluation_scores;
create policy "evaluation_scores: admin or owning coach update"
  on public.evaluation_scores for update
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_scores.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_scores.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_scores: admin or owning coach delete" on public.evaluation_scores;
create policy "evaluation_scores: admin or owning coach delete"
  on public.evaluation_scores for delete
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_scores.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_dofa: admin or owning coach write" on public.evaluation_dofa;
create policy "evaluation_dofa: admin or owning coach write"
  on public.evaluation_dofa for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_dofa: admin or owning coach update" on public.evaluation_dofa;
create policy "evaluation_dofa: admin or owning coach update"
  on public.evaluation_dofa for update
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_dofa: admin or owning coach delete" on public.evaluation_dofa;
create policy "evaluation_dofa: admin or owning coach delete"
  on public.evaluation_dofa for delete
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_goalie_dofa: admin or owning coach insert" on public.evaluation_goalie_dofa;
create policy "evaluation_goalie_dofa: admin or owning coach insert"
  on public.evaluation_goalie_dofa for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_goalie_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_goalie_dofa: admin or owning coach update" on public.evaluation_goalie_dofa;
create policy "evaluation_goalie_dofa: admin or owning coach update"
  on public.evaluation_goalie_dofa for update
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_goalie_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_goalie_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_goalie_dofa: admin or owning coach delete" on public.evaluation_goalie_dofa;
create policy "evaluation_goalie_dofa: admin or owning coach delete"
  on public.evaluation_goalie_dofa for delete
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_goalie_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_block_notes: admin or owning coach insert" on public.evaluation_block_notes;
create policy "evaluation_block_notes: admin or owning coach insert"
  on public.evaluation_block_notes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_block_notes.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_block_notes: admin or owning coach update" on public.evaluation_block_notes;
create policy "evaluation_block_notes: admin or owning coach update"
  on public.evaluation_block_notes for update
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_block_notes.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_block_notes.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

drop policy "evaluation_block_notes: admin or owning coach delete" on public.evaluation_block_notes;
create policy "evaluation_block_notes: admin or owning coach delete"
  on public.evaluation_block_notes for delete
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_block_notes.report_id
        and (
          (public.current_user_role() = 'admin' and public.profile_in_my_club(er.athlete_id))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

-- ----------------------------------------------------------------------------
-- Repuntar FKs que apuntaban a profiles(id) -- a people(id). Mismos UUIDs
-- (people.id se copió 1:1 de profiles.id), sin transformar ni perder datos.
-- ----------------------------------------------------------------------------

alter table public.athlete_profiles
  drop constraint athlete_profiles_id_fkey,
  add constraint athlete_profiles_id_fkey foreign key (id) references public.people (id) on delete cascade;

alter table public.coach_teams
  drop constraint coach_teams_coach_id_fkey,
  add constraint coach_teams_coach_id_fkey foreign key (coach_id) references public.people (id) on delete cascade;

alter table public.evaluation_reports
  drop constraint evaluation_reports_coach_id_fkey,
  add constraint evaluation_reports_coach_id_fkey foreign key (coach_id) references public.people (id);

alter table public.matches
  drop constraint matches_scorekeeper_id_fkey,
  add constraint matches_scorekeeper_id_fkey foreign key (scorekeeper_id) references public.people (id);

alter table public.stat_audit_log
  drop constraint stat_audit_log_changed_by_fkey,
  add constraint stat_audit_log_changed_by_fkey foreign key (changed_by) references public.people (id);

alter table public.survey_templates
  drop constraint survey_templates_created_by_fkey,
  add constraint survey_templates_created_by_fkey foreign key (created_by) references public.people (id);

alter table public.survey_responses
  drop constraint survey_responses_user_id_fkey,
  add constraint survey_responses_user_id_fkey foreign key (user_id) references public.people (id);

alter table public.training_sessions
  drop constraint training_sessions_created_by_fkey,
  add constraint training_sessions_created_by_fkey foreign key (created_by) references public.people (id);

alter table public.training_session_coaches
  drop constraint training_session_coaches_coach_id_fkey,
  add constraint training_session_coaches_coach_id_fkey foreign key (coach_id) references public.people (id);

-- ----------------------------------------------------------------------------
-- profiles ya no tiene lectores: si algo se me escapó y todavía la
-- referencia, este DROP falla acá (sin cascade a propósito) en vez de
-- borrar en silencio una policy/vista/función que se me haya pasado.
-- ----------------------------------------------------------------------------

drop table public.profiles;
