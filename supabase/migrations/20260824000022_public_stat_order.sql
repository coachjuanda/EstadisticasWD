-- CREATE OR REPLACE VIEW solo puede agregar columnas al final.
create or replace view public.public_tournament_stat_config as
select
  tsc.tournament_id,
  sd.key,
  sd.label,
  sd.applies_to,
  sd.scope,
  sd.sort_order
from public.tournament_stat_config tsc
join public.stat_definitions sd on sd.id = tsc.stat_definition_id
where tsc.enabled = true;
