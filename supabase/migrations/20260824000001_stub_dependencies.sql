-- ============================================================================
-- STUB DE DEPENDENCIAS — NO ES EL DISEÑO FINAL
-- ============================================================================
-- Este archivo existe únicamente para poder crear y probar match_player_stats
-- de forma aislada (FKs válidas + políticas RLS que referencian estas tablas).
-- clubs / profiles / athlete_profiles / teams / matches / coach_teams se
-- rediseñarán con sus columnas y policies completas en el resto del esquema.
-- Por ahora solo tienen las columnas mínimas para sostener las relaciones.
-- ============================================================================

create type public.user_role as enum ('admin', 'coach', 'scorekeeper', 'deportista');
create type public.match_status as enum ('programado', 'en_vivo', 'finalizado');

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

-- profiles.id = auth.users.id (1:1). En el esquema final esto se crea vía
-- trigger on auth.users, no lo modelamos aquí.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  club_id uuid not null references public.clubs (id),
  role public.user_role not null,
  status text not null default 'activo'
);

-- Deportista, 1:1 con profiles cuando profiles.role = 'deportista'.
create table public.athlete_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  tournament_id uuid not null references public.tournaments (id),
  home_team_id uuid not null references public.teams (id),
  away_team_name text not null,
  status public.match_status not null default 'programado',
  scorekeeper_id uuid references public.profiles (id)
);

-- Nómina = equipo + torneo. roster_players es la N:N que permite que un
-- mismo deportista esté en varias nóminas a la vez (distintos torneos y/o
-- divisiones simultáneamente).
create table public.rosters (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id),
  tournament_id uuid not null references public.tournaments (id),
  unique (team_id, tournament_id)
);

create table public.roster_players (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id),
  jersey_number int,
  unique (roster_id, athlete_id)
);

-- Equipos asignados a cada coach (N:N). Necesaria para acotar el SELECT del
-- coach en match_player_stats.
create table public.coach_teams (
  coach_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  primary key (coach_id, team_id)
);

-- ----------------------------------------------------------------------------
-- Helpers de RLS: leen el perfil del usuario autenticado una sola vez.
-- SECURITY DEFINER + search_path fijo para que puedan leer profiles sin
-- quedar atrapados en las propias policies de profiles (evita recursión) y
-- sin ser vulnerables a hijacking de search_path.
-- ----------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_club_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select club_id from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- RLS mínima en las tablas stub — solo lo necesario para que las policies de
-- match_player_stats puedan resolver sus subqueries. Se reemplaza por el
-- diseño completo cuando construyamos cada tabla en serio.
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
create policy "profiles: self read"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

alter table public.teams enable row level security;
create policy "teams: club members read"
  on public.teams for select
  to authenticated
  using (club_id = public.current_user_club_id());

alter table public.matches enable row level security;
create policy "matches: club members read"
  on public.matches for select
  to authenticated
  using (club_id = public.current_user_club_id());

alter table public.coach_teams enable row level security;
create policy "coach_teams: own rows"
  on public.coach_teams for select
  to authenticated
  using (coach_id = auth.uid());

alter table public.athlete_profiles enable row level security;
create policy "athlete_profiles: self read"
  on public.athlete_profiles for select
  to authenticated
  using (id = auth.uid());

-- tournaments / rosters / roster_players: RLS activada, sin policies todavía.
-- Nada en esta pasada las consulta directamente como `authenticated` — el
-- trigger que las lee (populate_match_player_stats_on_live) es SECURITY
-- DEFINER y no pasa por RLS. Políticas reales cuando diseñemos estas tablas.
alter table public.tournaments enable row level security;
alter table public.rosters enable row level security;
alter table public.roster_players enable row level security;
