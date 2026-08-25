-- ============================================================================
-- Reportes exportables (box score, perfil del deportista, resumen de equipo).
-- El deportista ya podía leer sus propias filas de match_player_stats
-- ("athlete reads own stats"), pero el box score y el resumen de equipo
-- muestran a TODO el equipo, no solo su fila -- necesita ver las de sus
-- compañeros de equipo, acotado a los torneos en los que él mismo está en la
-- nómina (no cualquier equipo del club, como sí puede coach/admin).
-- match_team_stats no tenía ninguna policy para deportista todavía (el box
-- score y el resumen de equipo también muestran la fila de equipo con
-- PP/PK).
-- ============================================================================

create policy "match_player_stats: athlete reads own team roster stats"
  on public.match_player_stats
  for select
  to authenticated
  using (
    public.current_user_role() = 'deportista'
    and exists (
      select 1
      from public.roster_players rp
      join public.rosters r on r.id = rp.roster_id
      join public.matches m on m.id = match_player_stats.match_id
      where rp.athlete_id = auth.uid()
        and r.team_id = match_player_stats.team_id
        and r.tournament_id = m.tournament_id
    )
  );

create policy "match_team_stats: athlete reads own team roster stats"
  on public.match_team_stats
  for select
  to authenticated
  using (
    public.current_user_role() = 'deportista'
    and exists (
      select 1
      from public.roster_players rp
      join public.rosters r on r.id = rp.roster_id
      join public.matches m on m.id = match_team_stats.match_id
      where rp.athlete_id = auth.uid()
        and r.team_id = match_team_stats.team_id
        and r.tournament_id = m.tournament_id
    )
  );
