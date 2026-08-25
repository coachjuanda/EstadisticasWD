-- ============================================================================
-- FIX — "match_player_stats: scorekeeper reads assigned live match" exige
-- matches.status = 'en_vivo', así que al finalizar el partido el scorekeeper
-- pierde también la LECTURA de las estadísticas que él mismo tomó, no solo
-- la edición. La pantalla de resumen post-partido del scorekeeper mostraba
-- "0 - 0" en vez del marcador real por esto. El requisito era perder el
-- permiso de EDITAR tras finalizar, no de ver su propio partido ya jugado.
-- ============================================================================

drop policy "match_player_stats: scorekeeper reads assigned live match" on public.match_player_stats;

create policy "match_player_stats: scorekeeper reads own matches"
  on public.match_player_stats
  for select
  to authenticated
  using (
    public.current_user_role() = 'scorekeeper'
    and exists (
      select 1 from public.matches m
      where m.id = match_player_stats.match_id
        and m.scorekeeper_id = auth.uid()
    )
  );
