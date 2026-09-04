-- ============================================================================
-- Columnas de REFERENCIA en athlete_profiles, para la carga inicial de
-- deportistas reales desde el Excel del club (Categoría, Liga, # Jersey, No.
-- Velopro). Puramente informativas -- ningún flujo del sistema (nóminas,
-- torneos, convocatorias) las lee ni las escribe. category/league son texto
-- con la lista separada por comas cuando una persona aparece en varias
-- categorías/ligas en el Excel (jersey/velopro no varían entre las filas
-- duplicadas de una misma persona, así que van como valor único).
-- ============================================================================

alter table public.athlete_profiles
  add column reference_category text,
  add column reference_league text,
  add column reference_jersey_number int,
  add column reference_velopro_id text;
