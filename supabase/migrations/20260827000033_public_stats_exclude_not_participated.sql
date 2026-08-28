-- ============================================================================
-- El marcador público (sin login) no debe mostrar a un jugador removido de
-- ESE partido puntual (participated = false) -- mismo criterio que la tabla
-- de captura del scorekeeper y el box score interno.
-- ============================================================================

create or replace view public.public_match_player_stats as
select
  mps.match_id,
  mps.athlete_id,
  mps.team_id,
  mps.stats,
  ap.full_name as athlete_full_name,
  rp.jersey_number
from public.match_player_stats mps
join public.matches m on m.id = mps.match_id
join public.athlete_profiles ap on ap.id = mps.athlete_id
left join public.rosters r on r.team_id = mps.team_id and r.tournament_id = m.tournament_id
left join public.roster_players rp on rp.roster_id = r.id and rp.athlete_id = mps.athlete_id
where m.status in ('en_vivo', 'finalizado')
  and mps.participated = true;

grant select on public.public_match_player_stats to anon, authenticated;
