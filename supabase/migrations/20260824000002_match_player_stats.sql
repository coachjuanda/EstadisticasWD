-- ============================================================================
-- match_player_stats — tabla real, para revisión.
-- Una fila por deportista por partido. `stats` es jsonb (stat_key -> valor)
-- porque el catálogo de estadísticas capturables es configurable por torneo
-- (Anexo A del brief), no fijo a nivel de esquema.
-- ============================================================================

create table public.match_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id) on delete restrict,
  team_id uuid not null references public.teams (id),
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, athlete_id)
);

create index match_player_stats_match_id_idx on public.match_player_stats (match_id);
create index match_player_stats_athlete_id_idx on public.match_player_stats (athlete_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_match_player_stats_updated_at
before update on public.match_player_stats
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-generación de filas al pasar el partido a "en_vivo": hala la nómina
-- (rosters + roster_players) del equipo local para ese torneo y crea una
-- fila en cero por cada jugador. El scorekeeper abre el partido y encuentra
-- la nómina ya cargada — no crea filas manualmente (por eso no tiene policy
-- de INSERT más abajo, solo UPDATE).
-- Solo cubre el equipo local: el visitante en `matches` es texto libre
-- (away_team_name), sin nómina en el sistema, así que no hay de dónde halar
-- sus jugadores. Confirmado con el club: cada torneo tiene un solo equipo
-- por categoría, así que dos equipos propios nunca se enfrentan y este caso
-- no se da en el MVP.
-- SECURITY DEFINER: corre con los privilegios de quien aplica la migración,
-- así el INSERT en match_player_stats no depende de los grants del rol que
-- dispara el UPDATE en matches (admin o scorekeeper, según quien abra el
-- partido).
-- ----------------------------------------------------------------------------

create or replace function public.populate_match_player_stats_on_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.match_player_stats (match_id, athlete_id, team_id, stats)
  select
    new.id,
    rp.athlete_id,
    new.home_team_id,
    '{}'::jsonb
  from public.rosters r
  join public.roster_players rp on rp.roster_id = r.id
  where r.team_id = new.home_team_id
    and r.tournament_id = new.tournament_id
  on conflict (match_id, athlete_id) do nothing;

  return new;
end;
$$;

create trigger trg_populate_match_player_stats_on_live
after update on public.matches
for each row
when (new.status = 'en_vivo' and old.status is distinct from 'en_vivo')
execute function public.populate_match_player_stats_on_live();

-- ----------------------------------------------------------------------------
-- Auditoría: en cada UPDATE, compara el jsonb viejo contra el nuevo y deja
-- una fila por cada stat_key que cambió (agregada, eliminada o modificada).
-- El scorekeeper solo hace UPDATE ... SET stats = ...; la auditoría queda
-- garantizada por el trigger, no depende de que el frontend la registre.
-- SECURITY DEFINER: corre con los privilegios del dueño de la función (quien
-- aplica esta migración), así puede escribir en stat_audit_log aunque el rol
-- que dispara el UPDATE (scorekeeper/admin) no tenga grants directos sobre
-- esa tabla.
-- ----------------------------------------------------------------------------

create table public.stat_audit_log (
  id uuid primary key default gen_random_uuid(),
  match_player_stat_id uuid not null references public.match_player_stats (id) on delete cascade,
  stat_key text not null,
  old_value numeric,
  new_value numeric,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

create index stat_audit_log_match_player_stat_id_idx on public.stat_audit_log (match_player_stat_id);

create or replace function public.log_match_player_stats_changes()
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
      match_player_stat_id, stat_key, old_value, new_value, changed_by
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

create trigger trg_log_match_player_stats_changes
after update on public.match_player_stats
for each row
when (old.stats is distinct from new.stats)
execute function public.log_match_player_stats_changes();

-- ----------------------------------------------------------------------------
-- Vista pública (sin login). Expone solo lo necesario para el marcador en
-- vivo: match_id, athlete_id, team_id y stats — nada de datos personales más
-- allá de lo que ya vive en esta tabla. No lleva `security_invoker`, así que
-- corre con los privilegios de quien la creó (el rol que aplica la migración,
-- típicamente dueño de la tabla) y por lo tanto NO queda sujeta a las RLS
-- policies de match_player_stats — son las que blindan la tabla base contra
-- acceso anónimo directo. El filtro de qué se expone vive en el WHERE de la
-- vista, no en RLS.
-- NOTA: hoy no filtra por club porque el MVP es de un solo club. Cuando haya
-- multi-club, este WHERE necesita acotarse también por club_id (vía el
-- subdominio del club, no vía sesión, porque el visitante es anónimo).
-- NOTA: el nombre del deportista no está aquí porque athlete_profiles todavía
-- es un stub — se agrega un join cuando esa tabla tenga su diseño final.
-- ----------------------------------------------------------------------------

create view public.public_match_player_stats as
select
  mps.match_id,
  mps.athlete_id,
  mps.team_id,
  mps.stats
from public.match_player_stats mps
join public.matches m on m.id = mps.match_id
where m.status in ('en_vivo', 'finalizado');

-- ----------------------------------------------------------------------------
-- Grants — quién puede tocar la tabla base a nivel de rol de Postgres, antes
-- de que entre RLS a filtrar filas. Nadie tiene DELETE: una estadística mal
-- puesta se corrige con UPDATE (y auditoría), no se borra. INSERT queda a
-- nivel de grant porque el admin sí puede necesitarlo (ej. un refuerzo de
-- último momento que no estaba en la nómina precargada); en la práctica solo
-- su policy "for all" lo habilita — el scorekeeper no tiene policy de INSERT,
-- así que aunque el grant se lo permita, RLS se lo bloquea.
-- ----------------------------------------------------------------------------

grant select, insert, update on public.match_player_stats to authenticated;
revoke all on public.match_player_stats from anon;

grant select on public.public_match_player_stats to anon, authenticated;

-- stat_audit_log: nadie escribe directo (solo el trigger, vía SECURITY
-- DEFINER); el admin lo lee a través de RLS.
grant select on public.stat_audit_log to authenticated;

-- ----------------------------------------------------------------------------
-- RLS policies
-- ----------------------------------------------------------------------------

alter table public.match_player_stats enable row level security;

-- Admin: control total, acotado a equipos de su propio club.
create policy "match_player_stats: admin full access"
  on public.match_player_stats
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

-- Coach: solo lectura, solo de los equipos que tiene asignados.
create policy "match_player_stats: coach reads own teams"
  on public.match_player_stats
  for select
  to authenticated
  using (
    public.current_user_role() = 'coach'
    and team_id in (select team_id from public.coach_teams where coach_id = auth.uid())
  );

-- Scorekeeper: solo el partido que tiene asignado, y solo mientras está en
-- vivo. Fuera de esa ventana no puede ni leer ni escribir (la corrección
-- post-partido es exclusiva del admin).
create policy "match_player_stats: scorekeeper reads assigned live match"
  on public.match_player_stats
  for select
  to authenticated
  using (
    public.current_user_role() = 'scorekeeper'
    and exists (
      select 1 from public.matches m
      where m.id = match_player_stats.match_id
        and m.scorekeeper_id = auth.uid()
        and m.status = 'en_vivo'
    )
  );

-- Sin policy de INSERT para scorekeeper a propósito: las filas las crea el
-- trigger populate_match_player_stats_on_live (SECURITY DEFINER) al abrir el
-- partido. El scorekeeper solo corrige valores en filas que ya existen.
create policy "match_player_stats: scorekeeper updates on assigned live match"
  on public.match_player_stats
  for update
  to authenticated
  using (
    public.current_user_role() = 'scorekeeper'
    and exists (
      select 1 from public.matches m
      where m.id = match_player_stats.match_id
        and m.scorekeeper_id = auth.uid()
        and m.status = 'en_vivo'
    )
  )
  with check (
    public.current_user_role() = 'scorekeeper'
    and exists (
      select 1 from public.matches m
      where m.id = match_player_stats.match_id
        and m.scorekeeper_id = auth.uid()
        and m.status = 'en_vivo'
    )
  );

-- Deportista: solo lectura de sus propias filas.
create policy "match_player_stats: athlete reads own stats"
  on public.match_player_stats
  for select
  to authenticated
  using (
    public.current_user_role() = 'deportista'
    and athlete_id = auth.uid()
  );

-- stat_audit_log: solo admin, y solo del propio club, vía el equipo al que
-- pertenece la estadística auditada.
alter table public.stat_audit_log enable row level security;

create policy "stat_audit_log: admin reads own club"
  on public.stat_audit_log
  for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1
      from public.match_player_stats mps
      join public.teams t on t.id = mps.team_id
      where mps.id = stat_audit_log.match_player_stat_id
        and t.club_id = public.current_user_club_id()
    )
  );
