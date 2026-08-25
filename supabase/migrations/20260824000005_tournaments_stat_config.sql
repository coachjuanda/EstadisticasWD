-- ============================================================================
-- GRUPO C — tournaments (finaliza el stub), tournament_divisions,
-- stat_definitions (catálogo del Anexo A) y tournament_stat_config.
-- ============================================================================

alter table public.tournaments
  add column league_id uuid references public.leagues (id),
  add column start_date date,
  add column end_date date;

alter table public.tournaments alter column league_id set not null;

-- Un torneo puede involucrar varias divisiones (ej. U12 y U14 en el mismo
-- torneo). N:N explícita porque el brief lo pide en plural ("división(es)
-- que participan"), aunque no estaba en la lista de tablas que mencionaste
-- — la agrego porque tournaments/teams no alcanza a representarlo sin ella.
create table public.tournament_divisions (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  division_id uuid not null references public.divisions (id),
  primary key (tournament_id, division_id)
);

-- Catálogo maestro del Anexo A. sport = null significa "aplica a ambos
-- deportes". applies_to distingue estadísticas de jugador de campo vs
-- portero, porque el formulario del scorekeeper las agrupa distinto.
create type public.stat_applies_to as enum ('jugador_de_campo', 'portero');

create table public.stat_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  applies_to public.stat_applies_to not null,
  sport public.sport
);

insert into public.stat_definitions (key, label, applies_to, sport) values
  ('shots', 'Disparos realizados', 'jugador_de_campo', null),
  ('shots_on_goal', 'Disparos al arco', 'jugador_de_campo', null),
  ('faceoffs_won', 'Faceoffs ganados', 'jugador_de_campo', null),
  ('faceoffs_lost', 'Faceoffs perdidos', 'jugador_de_campo', null),
  ('goals', 'Goles', 'jugador_de_campo', null),
  ('assists', 'Asistencias', 'jugador_de_campo', null),
  ('plus_minus', '+/-', 'jugador_de_campo', null),
  ('pp_effectiveness', 'Efectividad en power play', 'jugador_de_campo', null),
  ('pk_effectiveness', 'Efectividad en penalty kill', 'jugador_de_campo', null),
  ('blocked_shots', 'Disparos bloqueados por defensa', 'jugador_de_campo', 'hockey_linea'),
  ('offsides', 'Offsides', 'jugador_de_campo', 'hockey_linea'),
  ('icings', 'Icings', 'jugador_de_campo', 'hockey_linea'),
  ('two_on_one_for', '2-1 a favor', 'jugador_de_campo', 'hockey_hielo'),
  ('two_on_one_against', '2-1 en contra', 'jugador_de_campo', 'hockey_hielo'),
  ('three_on_two_for', '3-2 a favor', 'jugador_de_campo', 'hockey_hielo'),
  ('three_on_two_against', '3-2 en contra', 'jugador_de_campo', 'hockey_hielo'),
  ('shots_received', 'Disparos recibidos', 'portero', null),
  ('goals_received', 'Goles recibidos', 'portero', null);

-- Qué estadísticas de ese catálogo están activas para un torneo. El admin
-- las activa/desactiva al crear el torneo; save% de porteros se sigue
-- calculando en la app a partir de shots_received/goals_received, nunca se
-- ingresa manualmente.
create table public.tournament_stat_config (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  stat_definition_id uuid not null references public.stat_definitions (id),
  enabled boolean not null default true,
  primary key (tournament_id, stat_definition_id)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

create policy "tournaments: admin writes"
  on public.tournaments for all
  to authenticated
  using (public.current_user_role() = 'admin' and club_id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and club_id = public.current_user_club_id());

-- tournaments ya tenía RLS activada por el stub pero sin policy de select
-- para club members (el stub solo tenía policies en matches/teams, no en
-- tournaments) — la agrego ahora.
create policy "tournaments: club members read"
  on public.tournaments for select
  to authenticated
  using (club_id = public.current_user_club_id());

alter table public.tournament_divisions enable row level security;

create policy "tournament_divisions: club members read"
  on public.tournament_divisions for select
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_divisions.tournament_id
        and t.club_id = public.current_user_club_id()
    )
  );

create policy "tournament_divisions: admin writes"
  on public.tournament_divisions for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_divisions.tournament_id
        and t.club_id = public.current_user_club_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_divisions.tournament_id
        and t.club_id = public.current_user_club_id()
    )
  );

-- stat_definitions: catálogo global (no tiene club_id, no es un dato de
-- negocio de ningún club en particular), de solo lectura para cualquier
-- autenticado. Nadie lo edita desde el cliente por ahora: crece vía
-- migración, como cualquier catálogo versionado.
alter table public.stat_definitions enable row level security;

create policy "stat_definitions: any authenticated reads"
  on public.stat_definitions for select
  to authenticated
  using (true);

alter table public.tournament_stat_config enable row level security;

create policy "tournament_stat_config: club members read"
  on public.tournament_stat_config for select
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_stat_config.tournament_id
        and t.club_id = public.current_user_club_id()
    )
  );

create policy "tournament_stat_config: admin writes"
  on public.tournament_stat_config for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_stat_config.tournament_id
        and t.club_id = public.current_user_club_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_stat_config.tournament_id
        and t.club_id = public.current_user_club_id()
    )
  );

grant insert, update, delete on public.tournaments to authenticated;
grant select, insert, update, delete on public.tournament_divisions to authenticated;
grant select on public.stat_definitions to authenticated;
grant select, insert, update, delete on public.tournament_stat_config to authenticated;
