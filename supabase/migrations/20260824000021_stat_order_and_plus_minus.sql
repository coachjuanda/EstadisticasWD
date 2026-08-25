-- ============================================================================
-- 1. sort_order en stat_definitions -- controla el orden de columnas dentro
--    de cada grupo (jugador de campo / portero / equipo), no un orden global
--    único.
-- 2. "+/-" pasa de un solo contador a Plus + Minus por separado, con "+/-"
--    calculado en la UI (Plus - Minus), mismo patrón que SV% y Efectividad
--    PP/PK. plus_minus se RENOMBRA a "plus" (mismo id) en vez de borrarse,
--    porque el torneo real "Copa Futuras estrellas" ya lo tenía activo en
--    tournament_stat_config -- renombrar conserva esa configuración sin
--    tocarla. "minus" es una fila nueva, activada automáticamente en
--    cualquier torneo que ya tuviera "plus" activo.
-- 3. Renombres de texto pedidos + reorden exacto de jugador y equipo.
-- ============================================================================

alter table public.stat_definitions add column sort_order integer;

update public.stat_definitions set key = 'plus', label = 'Plus' where key = 'plus_minus';

insert into public.stat_definitions (key, label, applies_to, scope) values
  ('minus', 'Minus', 'jugador_de_campo', 'jugador');

insert into public.tournament_stat_config (tournament_id, stat_definition_id, enabled)
select tsc.tournament_id, (select id from public.stat_definitions where key = 'minus'), tsc.enabled
from public.tournament_stat_config tsc
join public.stat_definitions sd on sd.id = tsc.stat_definition_id
where sd.key = 'plus'
on conflict (tournament_id, stat_definition_id) do nothing;

-- Renombres de texto pedidos.
update public.stat_definitions set label = 'Gol' where key = 'goals';
update public.stat_definitions set label = 'Asistencia' where key = 'assists';
update public.stat_definitions set label = 'Disparo' where key = 'shots';
update public.stat_definitions set label = 'Disparo al arco' where key = 'shots_on_goal';
update public.stat_definitions set label = 'Disparo bloqueado' where key = 'blocked_shots';
update public.stat_definitions set label = 'Faceoff ganado' where key = 'faceoffs_won';
update public.stat_definitions set label = 'Faceoff perdido' where key = 'faceoffs_lost';
update public.stat_definitions set label = 'Gol en PP' where key = 'pp_goal';
update public.stat_definitions set label = 'Gol en contra PK' where key = 'pk_goal';
update public.stat_definitions set label = 'Icing' where key = 'icings';

-- Orden exacto -- jugador de campo.
update public.stat_definitions set sort_order = 1 where key = 'goals';
update public.stat_definitions set sort_order = 2 where key = 'assists';
update public.stat_definitions set sort_order = 3 where key = 'shots';
update public.stat_definitions set sort_order = 4 where key = 'shots_on_goal';
update public.stat_definitions set sort_order = 5 where key = 'blocked_shots';
update public.stat_definitions set sort_order = 6 where key = 'faceoffs_won';
update public.stat_definitions set sort_order = 7 where key = 'faceoffs_lost';
update public.stat_definitions set sort_order = 8 where key = 'plus';
update public.stat_definitions set sort_order = 9 where key = 'minus';

-- Portero -- no se pidió reorden explícito, se deja un orden estable.
update public.stat_definitions set sort_order = 1 where key = 'shots_received';
update public.stat_definitions set sort_order = 2 where key = 'goals_received';

-- Orden exacto -- equipo.
update public.stat_definitions set sort_order = 1 where key = 'pp';
update public.stat_definitions set sort_order = 2 where key = 'pk';
update public.stat_definitions set sort_order = 3 where key = 'pp_goal';
update public.stat_definitions set sort_order = 4 where key = 'pk_goal';
update public.stat_definitions set sort_order = 5 where key = 'offsides';
update public.stat_definitions set sort_order = 6 where key = 'icings';
update public.stat_definitions set sort_order = 7 where key = 'two_on_one_for';
update public.stat_definitions set sort_order = 8 where key = 'two_on_one_against';
update public.stat_definitions set sort_order = 9 where key = 'three_on_two_for';
update public.stat_definitions set sort_order = 10 where key = 'three_on_two_against';
