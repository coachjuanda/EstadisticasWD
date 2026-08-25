-- ============================================================================
-- GRUPO D — rosters, roster_players, matches, coach_teams: RLS real
-- (las columnas de rosters/roster_players ya estaban completas en el stub;
-- matches necesita fecha/hora y cancha, que faltaban).
-- ============================================================================

alter table public.matches
  add column scheduled_at timestamptz,
  add column location text;

alter table public.matches alter column scheduled_at set not null;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

-- rosters / roster_players: cualquier miembro del club puede leer (se
-- necesita para mostrar nóminas en varias pantallas); solo admin escribe.
alter table public.rosters enable row level security;

create policy "rosters: club members read"
  on public.rosters for select
  to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = rosters.team_id
        and t.club_id = public.current_user_club_id()
    )
  );

create policy "rosters: admin writes"
  on public.rosters for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.teams t
      where t.id = rosters.team_id
        and t.club_id = public.current_user_club_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.teams t
      where t.id = rosters.team_id
        and t.club_id = public.current_user_club_id()
    )
  );

alter table public.roster_players enable row level security;

create policy "roster_players: club members read"
  on public.roster_players for select
  to authenticated
  using (
    exists (
      select 1 from public.rosters r
      join public.teams t on t.id = r.team_id
      where r.id = roster_players.roster_id
        and t.club_id = public.current_user_club_id()
    )
  );

create policy "roster_players: admin writes"
  on public.roster_players for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.rosters r
      join public.teams t on t.id = r.team_id
      where r.id = roster_players.roster_id
        and t.club_id = public.current_user_club_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.rosters r
      join public.teams t on t.id = r.team_id
      where r.id = roster_players.roster_id
        and t.club_id = public.current_user_club_id()
    )
  );

-- matches: "matches: club members read" ya existía en el stub. Falta admin
-- (control total) y scorekeeper (solo su propio partido, para poder abrirlo
-- y marcarlo en_vivo/finalizado — el UPDATE de estadísticas puntuales vive
-- en match_player_stats, esto es solo el estado del partido en sí).
create policy "matches: admin writes"
  on public.matches for all
  to authenticated
  using (public.current_user_role() = 'admin' and club_id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and club_id = public.current_user_club_id());

create policy "matches: scorekeeper updates own match"
  on public.matches for update
  to authenticated
  using (public.current_user_role() = 'scorekeeper' and scorekeeper_id = auth.uid())
  with check (public.current_user_role() = 'scorekeeper' and scorekeeper_id = auth.uid());

-- coach_teams: el stub ya tenía "coach_teams: own rows" (select). Falta que
-- el admin pueda gestionar las asignaciones de coach a equipo.
create policy "coach_teams: admin writes"
  on public.coach_teams for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.teams t
      where t.id = coach_teams.team_id
        and t.club_id = public.current_user_club_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.teams t
      where t.id = coach_teams.team_id
        and t.club_id = public.current_user_club_id()
    )
  );

grant select, insert, update, delete on public.rosters to authenticated;
grant select, insert, update, delete on public.roster_players to authenticated;
grant insert, update, delete on public.matches to authenticated;
grant insert, update, delete on public.coach_teams to authenticated;
