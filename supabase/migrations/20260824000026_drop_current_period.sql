-- ============================================================================
-- Se quita current_period: era puramente informativo (badge P1/P2/P3/OT en
-- scorekeeper y vista pública), nunca alimentó ningún cálculo de marcador,
-- estadística, reporte ni policy de RLS -- confirmado revisando cada lugar
-- que lo tocaba antes de este cambio. Se quita en este orden: primero el
-- trigger que lo validaba, luego las vistas que lo exponían (CREATE OR
-- REPLACE VIEW no puede quitar una columna existente, así que van con DROP +
-- CREATE), luego la columna de la tabla, y por último el tipo enum que ya
-- no usa nadie más.
-- ============================================================================

drop trigger trg_enforce_current_period_update on public.matches;
drop function public.enforce_current_period_update();

drop view public.public_match_summary;

create view public.public_match_summary as
select
  m.id as match_id,
  m.status,
  m.scheduled_at,
  m.location,
  m.away_team_name,
  m.home_team_id,
  t.name as home_team_name,
  tour.name as tournament_name,
  m.tournament_id
from public.matches m
join public.teams t on t.id = m.home_team_id
join public.tournaments tour on tour.id = m.tournament_id
where m.status in ('en_vivo', 'finalizado');

grant select on public.public_match_summary to anon, authenticated;

alter table public.matches drop column current_period;

drop type public.match_period;
