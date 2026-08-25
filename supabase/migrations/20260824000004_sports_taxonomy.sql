-- ============================================================================
-- GRUPO B — divisions, leagues (nuevas), teams (reemplaza el stub)
-- ============================================================================

create type public.sport as enum ('hockey_linea', 'hockey_hielo');

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null,
  sport public.sport not null
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null
);

alter table public.teams
  add column division_id uuid references public.divisions (id),
  add column sport public.sport;

alter table public.teams alter column division_id set not null;
alter table public.teams alter column sport set not null;

-- ----------------------------------------------------------------------------
-- RLS: lectura para cualquier miembro del club, escritura exclusiva de admin.
-- Mismo patrón en las tres tablas.
-- ----------------------------------------------------------------------------

alter table public.divisions enable row level security;

create policy "divisions: club members read"
  on public.divisions for select
  to authenticated
  using (club_id = public.current_user_club_id());

create policy "divisions: admin writes"
  on public.divisions for all
  to authenticated
  using (public.current_user_role() = 'admin' and club_id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and club_id = public.current_user_club_id());

alter table public.leagues enable row level security;

create policy "leagues: club members read"
  on public.leagues for select
  to authenticated
  using (club_id = public.current_user_club_id());

create policy "leagues: admin writes"
  on public.leagues for all
  to authenticated
  using (public.current_user_role() = 'admin' and club_id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and club_id = public.current_user_club_id());

-- teams ya tenía "teams: club members read" del stub (queda igual, sigue
-- sirviendo). Solo falta la policy de escritura para admin.
create policy "teams: admin writes"
  on public.teams for all
  to authenticated
  using (public.current_user_role() = 'admin' and club_id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and club_id = public.current_user_club_id());

grant select, insert, update, delete on public.divisions to authenticated;
grant select, insert, update, delete on public.leagues to authenticated;
grant insert, update, delete on public.teams to authenticated;
