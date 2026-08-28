-- ============================================================================
-- roster_players gana created_at -- necesario para sugerir el número de
-- camiseta más reciente de un deportista entre sus otras nóminas (si tiene
-- números distintos en varias, se usa el de la nómina donde fue agregado más
-- recientemente).
-- ============================================================================

alter table public.roster_players
  add column created_at timestamptz not null default now();
