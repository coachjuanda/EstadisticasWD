-- ============================================================================
-- La vista pública del marcador ordenaba a los jugadores alfabéticamente por
-- nombre porque nunca tuvo el número de camiseta disponible. Para ordenar por
-- camiseta ascendente ahí también (mismo criterio que scorekeeper/box score/
-- resumen de equipo) hace falta exponerlo -- se resuelve vía rosters +
-- roster_players (el mismo par team_id+tournament_id que ya usan las otras
-- pantallas para esto). LEFT JOIN a propósito: un jugador sin nómina cargada
-- para ese torneo/equipo (caso raro, pero posible) no debe desaparecer del
-- marcador, solo mostrar "sin número".
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
where m.status in ('en_vivo', 'finalizado');

grant select on public.public_match_player_stats to anon, authenticated;
