-- ============================================================================
-- La tabla pública de estadísticas necesita columnas estables (las
-- estadísticas configuradas para el torneo), no un set que aparece/
-- desaparece según qué stat_key ya se tocó al menos una vez en algún
-- jugador (stats arranca en '{}' y jsonb_set solo agrega la clave la
-- primera vez que se incrementa). Para eso el público necesita saber qué
-- stats están activas para el torneo -- tournament_stat_config no es
-- público, así que expone una vista igual que las demás.
-- ============================================================================

create or replace view public.public_tournament_stat_config as
select
  tsc.tournament_id,
  sd.key,
  sd.label,
  sd.applies_to
from public.tournament_stat_config tsc
join public.stat_definitions sd on sd.id = tsc.stat_definition_id
where tsc.enabled = true;

grant select on public.public_tournament_stat_config to anon, authenticated;

-- CREATE OR REPLACE VIEW puede agregar columnas al final sin romper nada
-- existente.
create or replace view public.public_match_summary as
select
  m.id as match_id,
  m.status,
  m.current_period,
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
