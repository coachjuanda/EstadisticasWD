-- ============================================================================
-- current_period en matches, con las mismas reglas de permiso que
-- match_player_stats: scorekeeper solo mientras el partido está en_vivo,
-- admin en cualquier momento.
--
-- La policy "matches: scorekeeper updates own match" ya existente permite al
-- scorekeeper actualizar CUALQUIER columna de su propio partido en cualquier
-- estado (necesario para que pueda hacer las transiciones de estado
-- programado->en_vivo->finalizado). RLS no puede expresar por sí sola "esta
-- columna en particular solo si status=en_vivo" sin también bloquear esas
-- transiciones de estado -- por eso la regla extra de current_period vive en
-- un trigger, que sí puede comparar OLD vs NEW.
-- ============================================================================

create type public.match_period as enum ('P1', 'P2', 'P3', 'OT');

alter table public.matches add column current_period public.match_period;

create or replace function public.enforce_current_period_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.current_period is distinct from old.current_period then
    if public.current_user_role() = 'scorekeeper' and old.status <> 'en_vivo' then
      raise exception 'Solo se puede cambiar el período mientras el partido está en vivo.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_current_period_update
before update on public.matches
for each row
execute function public.enforce_current_period_update();

-- ----------------------------------------------------------------------------
-- Vista pública: agrega el nombre del jugador (athlete_profiles ya tiene
-- diseño real, esto quedó pendiente de cuando era stub).
-- ----------------------------------------------------------------------------

create or replace view public.public_match_player_stats as
select
  mps.match_id,
  mps.athlete_id,
  mps.team_id,
  mps.stats,
  ap.full_name as athlete_full_name
from public.match_player_stats mps
join public.matches m on m.id = mps.match_id
join public.athlete_profiles ap on ap.id = mps.athlete_id
where m.status in ('en_vivo', 'finalizado');

-- ----------------------------------------------------------------------------
-- Vista pública nueva: info del partido en sí (nombre de equipos, estado,
-- período, fecha/cancha) -- matches tiene RLS que bloquea a anon, así que el
-- marcador público necesita su propia vista igual que las estadísticas.
-- ----------------------------------------------------------------------------

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
  tour.name as tournament_name
from public.matches m
join public.teams t on t.id = m.home_team_id
join public.tournaments tour on tour.id = m.tournament_id
where m.status in ('en_vivo', 'finalizado');

grant select on public.public_match_player_stats to anon, authenticated;
grant select on public.public_match_summary to anon, authenticated;

-- ----------------------------------------------------------------------------
-- RPC para incrementar/decrementar una estadística de forma atómica. Un
-- UPDATE ... SET stats = jsonb_set(...) directo desde el cliente requeriría
-- leer el valor actual antes de escribir el nuevo -- con taps rápidos en
-- tablet, dos taps casi simultáneos podrían leer el mismo valor viejo y
-- perder uno de los dos incrementos. Esta función hace el "+1"/"-1" en el
-- propio UPDATE, sin round-trip de lectura previa. SECURITY INVOKER (el
-- default): el UPDATE interno sigue sujeto a las RLS policies normales de
-- match_player_stats (scorekeeper solo en su partido en vivo, admin siempre).
-- ----------------------------------------------------------------------------

create or replace function public.increment_match_stat(
  p_match_player_stat_id uuid,
  p_stat_key text,
  p_delta int
) returns jsonb
language sql
security invoker
set search_path = public
as $$
  update public.match_player_stats
  set stats = jsonb_set(
    stats,
    array[p_stat_key],
    to_jsonb(greatest(0, coalesce((stats ->> p_stat_key)::int, 0) + p_delta))
  )
  where id = p_match_player_stat_id
  returning stats;
$$;

grant execute on function public.increment_match_stat(uuid, text, int) to authenticated;
