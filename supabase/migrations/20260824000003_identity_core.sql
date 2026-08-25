-- ============================================================================
-- GRUPO A — clubs, profiles, athlete_profiles: diseño real (reemplaza el stub)
-- ============================================================================

-- clubs -----------------------------------------------------------------
alter table public.clubs
  add column logo_url text,
  add column subdomain text unique;

-- profiles ----------------------------------------------------------------
create type public.user_status as enum ('activo', 'inactivo');

alter table public.profiles alter column status drop default;
alter table public.profiles alter column status type public.user_status using status::public.user_status;
alter table public.profiles alter column status set default 'activo'::public.user_status;

alter table public.profiles
  add column full_name text not null,
  add column email text not null;

-- Autocompleta profiles al crear el usuario en auth.users. El admin crea
-- usuarios vía Admin API pasando role/club_id/full_name en user_metadata;
-- este trigger es lo único que necesita el frontend para no tener que hacer
-- un segundo INSERT manual a profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, club_id, role, full_name, email, status)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'club_id')::uuid,
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'activo'
  );
  return new;
end;
$$;

create trigger trg_handle_new_user
after insert on auth.users
for each row
execute function public.handle_new_user();

-- athlete_profiles ----------------------------------------------------------
create type public.athlete_position as enum ('jugador_de_campo', 'portero');

alter table public.athlete_profiles
  add column date_of_birth date,
  add column photo_url text,
  add column position public.athlete_position;

-- Auto-provisiona la fila de athlete_profiles cuando se crea un profile con
-- rol 'deportista' (encadenado con handle_new_user: auth.users -> profiles
-- -> athlete_profiles). El admin no necesita un segundo INSERT manual.
create or replace function public.handle_new_athlete_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'deportista' then
    insert into public.athlete_profiles (id, full_name)
    values (new.id, new.full_name)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_handle_new_athlete_profile
after insert on public.profiles
for each row
execute function public.handle_new_athlete_profile();

-- ----------------------------------------------------------------------------
-- RLS: reemplaza las policies mínimas del stub por las reales.
-- ----------------------------------------------------------------------------

drop policy "profiles: self read" on public.profiles;

create policy "profiles: self read"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: admin reads own club"
  on public.profiles for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and club_id = public.current_user_club_id()
  );

-- El admin edita estado/rol/club de usuarios de su club (nunca inserta él
-- mismo: eso lo hace el trigger handle_new_user cuando el Admin API crea el
-- auth.users). Sin policy de INSERT/DELETE para nadie: altas y bajas de
-- usuarios pasan por Supabase Auth (Admin API + auth.users), no por INSERT
-- directo a profiles.
create policy "profiles: admin updates own club"
  on public.profiles for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and club_id = public.current_user_club_id()
  )
  with check (
    public.current_user_role() = 'admin'
    and club_id = public.current_user_club_id()
  );

drop policy "athlete_profiles: self read" on public.athlete_profiles;

-- El nombre/foto/posición de un deportista no es sensible dentro del propio
-- club (el brief permite exponer nombre+stats incluso al público sin login),
-- así que cualquier usuario autenticado del mismo club puede leerlo. Esto
-- evita tener que replicar la cadena roster->team->coach_teams solo para
-- mostrar un nombre en la UI de evaluaciones/estadísticas.
create policy "athlete_profiles: club members read"
  on public.athlete_profiles for select
  to authenticated
  using (
    id in (select id from public.profiles where club_id = public.current_user_club_id())
  );

-- El deportista edita su propio perfil (en la práctica, el frontend solo
-- expone el campo de foto — no hay una forma limpia de restringir a nivel de
-- columna con un solo rol de Postgres compartido por todos los roles de app,
-- así que la restricción a "solo foto" queda en el formulario del frontend,
-- no en RLS).
create policy "athlete_profiles: self update"
  on public.athlete_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "athlete_profiles: admin full access"
  on public.athlete_profiles for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and id in (select id from public.profiles where club_id = public.current_user_club_id())
  )
  with check (
    public.current_user_role() = 'admin'
    and id in (select id from public.profiles where club_id = public.current_user_club_id())
  );

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.athlete_profiles to authenticated;
