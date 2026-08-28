-- ============================================================================
-- match_player_stats gana "participated": distingue "jugó y no logró
-- ninguna estadística" (participated = true, stats en cero) de "no jugó este
-- partido puntual" (participated = false -- lesión, inasistencia, etc).
--
-- Vive en match_player_stats (no en roster_players) a propósito: es un hecho
-- de ESE partido, no de la nómina del torneo. Remover a alguien de un
-- partido no lo saca de la nómina ni afecta otros partidos.
--
-- No hace falta tocar RLS: las policies de UPDATE ya existentes para
-- scorekeeper/admin operan sobre la fila completa, así que ya cubren este
-- nuevo campo.
-- ============================================================================

alter table public.match_player_stats
  add column participated boolean not null default true;
