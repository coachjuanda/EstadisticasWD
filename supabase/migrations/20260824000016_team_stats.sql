-- ============================================================================
-- match_team_stats — mismo patrón que match_player_stats (tabla, trigger de
-- auditoría, RLS, auto-población al pasar a en_vivo, RPC de incremento
-- atómico), pero para estadísticas que describen al equipo como un todo, no
-- a un jugador: PP, PK, offsides, icings, y 2-1/3-2 a favor/en contra
-- (hockey en hielo) -- todas describen una situación de juego del equipo
-- completo, no una acción individual.
-- ============================================================================

create type public.stat_scope as enum ('jugador', 'equipo');

alter table public.stat_definitions add column scope public.stat_scope not null default 'jugador';
alter table public.stat_definitions alter column applies_to drop not null;

update public.stat_definitions
set scope = 'equipo', applies_to = null
where key in (
  'pp_effectiveness', 'pk_effectiveness', 'offsides', 'icings',
  'two_on_one_for', 'two_on_one_against', 'three_on_two_for', 'three_on_two_against'
);

-- ----------------------------------------------------------------------------
-- Tabla
-- ----------------------------------------------------------------------------

create table public.match_team_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id),
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, team_id)
);

create index match_team_stats_match_id_idx on public.match_team_stats (match_id);

create trigger trg_match_team_stats_updated_at
before update on public.match_team_stats
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auditoría unificada: stat_audit_log ahora puede apuntar a una fila de
-- match_player_stats O a una de match_team_stats (exactamente una de las
-- dos, nunca ambas ni ninguna).
-- ----------------------------------------------------------------------------

alter table public.stat_audit_log alter column match_player_stat_id drop not null;
alter table public.stat_audit_log add column match_team_stat_id uuid references public.match_team_stats (id) on delete cascade;

alter table public.stat_audit_log add constraint stat_audit_log_exactly_one_target check (
  (match_player_stat_id is not null and match_team_stat_id is null)
  or (match_player_stat_id is null and match_team_stat_id is not null)
);

create or replace function public.log_match_team_stats_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_key text;
begin
  for changed_key in
    select coalesce(o.key, n.key)
    from jsonb_each(coalesce(old.stats, '{}'::jsonb)) as o(key, value)
    full outer join jsonb_each(coalesce(new.stats, '{}'::jsonb)) as n(key, value)
      on o.key = n.key
    where o.value is distinct from n.value
  loop
    insert into public.stat_audit_log (
      match_team_stat_id, stat_key, old_value, new_value, changed_by
    )
    values (
      new.id,
      changed_key,
      (old.stats ->> changed_key)::numeric,
      (new.stats ->> changed_key)::numeric,
      auth.uid()
    );
  end loop;
  return new;
end;
$$;

create trigger trg_log_match_team_stats_changes
after update on public.match_team_stats
for each row
when (old.stats is distinct from new.stats)
execute function public.log_match_team_stats_changes();

-- stat_audit_log RLS: la policy de admin ahora tiene que cubrir ambos casos.
drop policy "stat_audit_log: admin reads own club" on public.stat_audit_log;

create policy "stat_audit_log: admin reads own club"
  on public.stat_audit_log
  for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and (
      exists (
        select 1
        from public.match_player_stats mps
        join public.teams t on t.id = mps.team_id
        where mps.id = stat_audit_log.match_player_stat_id
          and t.club_id = public.current_user_club_id()
      )
      or exists (
        select 1
        from public.match_team_stats mts
        join public.teams t on t.id = mts.team_id
        where mts.id = stat_audit_log.match_team_stat_id
          and t.club_id = public.current_user_club_id()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- Auto-población al pasar a en_vivo: una fila por equipo local (mismo
-- alcance que match_player_stats -- el visitante no está en el sistema).
-- ----------------------------------------------------------------------------

create or replace function public.populate_match_team_stats_on_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.match_team_stats (match_id, team_id, stats)
  values (new.id, new.home_team_id, '{}'::jsonb)
  on conflict (match_id, team_id) do nothing;
  return new;
end;
$$;

create trigger trg_populate_match_team_stats_on_live
after update on public.matches
for each row
when (new.status = 'en_vivo' and old.status is distinct from 'en_vivo')
execute function public.populate_match_team_stats_on_live();

-- ----------------------------------------------------------------------------
-- RLS -- mismas reglas que match_player_stats: admin control total en su
-- club, scorekeeper solo su partido asignado mientras está en_vivo (lectura
-- ampliada a cualquier estado del propio partido, igual que se corrigió para
-- match_player_stats).
-- ----------------------------------------------------------------------------

alter table public.match_team_stats enable row level security;

create policy "match_team_stats: admin full access"
  on public.match_team_stats
  for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and team_id in (select id from public.teams where club_id = public.current_user_club_id())
  )
  with check (
    public.current_user_role() = 'admin'
    and team_id in (select id from public.teams where club_id = public.current_user_club_id())
  );

create policy "match_team_stats: coach reads own teams"
  on public.match_team_stats
  for select
  to authenticated
  using (
    public.current_user_role() = 'coach'
    and team_id in (select team_id from public.coach_teams where coach_id = auth.uid())
  );

create policy "match_team_stats: scorekeeper reads own matches"
  on public.match_team_stats
  for select
  to authenticated
  using (
    public.current_user_role() = 'scorekeeper'
    and exists (
      select 1 from public.matches m
      where m.id = match_team_stats.match_id
        and m.scorekeeper_id = auth.uid()
    )
  );

create policy "match_team_stats: scorekeeper updates on assigned live match"
  on public.match_team_stats
  for update
  to authenticated
  using (
    public.current_user_role() = 'scorekeeper'
    and exists (
      select 1 from public.matches m
      where m.id = match_team_stats.match_id
        and m.scorekeeper_id = auth.uid()
        and m.status = 'en_vivo'
    )
  )
  with check (
    public.current_user_role() = 'scorekeeper'
    and exists (
      select 1 from public.matches m
      where m.id = match_team_stats.match_id
        and m.scorekeeper_id = auth.uid()
        and m.status = 'en_vivo'
    )
  );

grant select, insert, update on public.match_team_stats to authenticated;
revoke all on public.match_team_stats from anon;

-- ----------------------------------------------------------------------------
-- RPC de incremento atómico, mismo patrón que increment_match_stat.
-- ----------------------------------------------------------------------------

create or replace function public.increment_match_team_stat(
  p_match_team_stat_id uuid,
  p_stat_key text,
  p_delta int
) returns jsonb
language sql
security invoker
set search_path = public
as $$
  update public.match_team_stats
  set stats = jsonb_set(
    stats,
    array[p_stat_key],
    to_jsonb(greatest(0, coalesce((stats ->> p_stat_key)::int, 0) + p_delta))
  )
  where id = p_match_team_stat_id
  returning stats;
$$;

grant execute on function public.increment_match_team_stat(uuid, text, int) to authenticated;
