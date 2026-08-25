-- ============================================================================
-- PP/PK pasan de un solo "contador de efectividad" (que no tiene sentido
-- como botón +/-: ¿qué significa tapear +1 sobre un porcentaje?) a 4
-- contadores capturables + 2 porcentajes calculados, mismo patrón que el
-- SV% de porteros:
--   PP, PP Goal      -> contadores (goles anotados en ventaja numérica)
--   PK, PK Goal      -> contadores (goles recibidos en desventaja numérica)
--   Efectividad PP   = PP Goal / PP           (calculada, no se ingresa)
--   Efectividad PK   = (PK - PK Goal) / PK    (calculada, no se ingresa)
--
-- pp_effectiveness/pk_effectiveness se RENOMBRAN a pp/pk (mismo id, mismo
-- registro) en vez de borrarse y recrearse, porque el torneo real "Copa
-- Futuras estrellas" ya los tiene activos en tournament_stat_config -- si se
-- borraran, esa referencia rompería (la FK no tiene ON DELETE CASCADE a
-- propósito). Renombrar conserva la configuración existente sin tocarla.
-- ============================================================================

update public.stat_definitions set key = 'pp', label = 'PP (ventaja numérica)' where key = 'pp_effectiveness';
update public.stat_definitions set key = 'pk', label = 'PK (desventaja numérica)' where key = 'pk_effectiveness';

insert into public.stat_definitions (key, label, applies_to, scope) values
  ('pp_goal', 'PP Goal', null, 'equipo'),
  ('pk_goal', 'PK Goal', null, 'equipo');

-- Cualquier torneo que ya tuviera PP activo necesita también PP Goal para
-- que el porcentaje se pueda calcular (y análogo para PK) -- si no, quedaría
-- un torneo real con el contador PP pero sin forma de capturar los goles
-- anotados en esas ocasiones.
insert into public.tournament_stat_config (tournament_id, stat_definition_id, enabled)
select tsc.tournament_id, (select id from public.stat_definitions where key = 'pp_goal'), tsc.enabled
from public.tournament_stat_config tsc
join public.stat_definitions sd on sd.id = tsc.stat_definition_id
where sd.key = 'pp'
on conflict (tournament_id, stat_definition_id) do nothing;

insert into public.tournament_stat_config (tournament_id, stat_definition_id, enabled)
select tsc.tournament_id, (select id from public.stat_definitions where key = 'pk_goal'), tsc.enabled
from public.tournament_stat_config tsc
join public.stat_definitions sd on sd.id = tsc.stat_definition_id
where sd.key = 'pk'
on conflict (tournament_id, stat_definition_id) do nothing;
