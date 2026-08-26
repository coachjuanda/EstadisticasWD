-- ============================================================================
-- Módulo de asistencia a entrenamientos -- diseño acordado:
--
-- team_members: relación deportista<->equipo VIGENTE, independiente de
-- nómina de torneo (roster_players). Un entrenamiento es de la
-- categoría/división en general, sin torneo asociado, así que no puede
-- depender de qué nómina de qué torneo esté activa en ese momento -- eso
-- dejaría huecos en pretemporada/post-temporada y es ambiguo si una división
-- llega a tener más de un equipo. Se siembra con un backfill de los pares
-- (team_id, athlete_id) que ya existen en roster_players, y de ahí en
-- adelante se mantiene con un alta automática cuando el admin agrega un
-- deportista a una nómina de torneo (ver actions.ts) -- quitarlo de ESA
-- nómina no lo saca de team_members, porque competir y entrenar son cosas
-- distintas.
--
-- training_sessions + training_session_divisions (puente, mismo patrón que
-- tournament_divisions) + training_attendance: una sesión de entrenamiento
-- se crea en un solo paso (fecha/hora/cancha + una o más divisiones), y la
-- convocatoria (las filas de training_attendance) se genera en la MISMA
-- transacción a partir de team_members de los equipos de esas divisiones --
-- por eso training_sessions no tiene estados (programado/en_vivo/etc.): no
-- hace falta, todo pasa de una vez.
--
-- athlete_id en training_attendance NO tiene cascade (es historial real,
-- mismo criterio que match_player_stats/evaluation_reports) -- se agrega
-- como razón de bloqueo en deleteUserAction en el mismo commit que esta
-- migración. team_members sí cascadea: ser miembro de un equipo no es
-- historial, es un hecho vigente, no hay nada que preservar.
--
-- Nota de orden: las tres tablas se crean todas ANTES que cualquier policy
-- de RLS -- una policy de training_sessions necesita referenciar
-- training_attendance (para que el deportista lea sus propias sesiones), y
-- CREATE POLICY valida ese nombre contra el catálogo en el momento de
-- crearse, igual que una vista.
-- ============================================================================

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, athlete_id)
);

insert into public.team_members (team_id, athlete_id)
select distinct r.team_id, rp.athlete_id
from public.roster_players rp
join public.rosters r on r.id = rp.roster_id
on conflict (team_id, athlete_id) do nothing;

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  created_by uuid not null references public.profiles (id),
  scheduled_at timestamptz not null,
  location text,
  created_at timestamptz not null default now()
);

create index training_sessions_club_id_idx on public.training_sessions (club_id);

create table public.training_session_divisions (
  training_session_id uuid not null references public.training_sessions (id) on delete cascade,
  division_id uuid not null references public.divisions (id),
  primary key (training_session_id, division_id)
);

create table public.training_attendance (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.training_sessions (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id),
  present boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_session_id, athlete_id)
);

create index training_attendance_athlete_id_idx on public.training_attendance (athlete_id);

create trigger trg_training_attendance_updated_at
before update on public.training_attendance
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS -- team_members
-- ----------------------------------------------------------------------------

alter table public.team_members enable row level security;

create policy "team_members: club members read"
  on public.team_members for select
  to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and t.club_id = public.current_user_club_id()
    )
  );

create policy "team_members: admin writes"
  on public.team_members for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and t.club_id = public.current_user_club_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and t.club_id = public.current_user_club_id()
    )
  );

grant select, insert, update, delete on public.team_members to authenticated;

-- ----------------------------------------------------------------------------
-- RLS -- training_sessions
-- ----------------------------------------------------------------------------

alter table public.training_sessions enable row level security;

create policy "training_sessions: admin full access"
  on public.training_sessions for all
  to authenticated
  using (public.current_user_role() = 'admin' and club_id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and club_id = public.current_user_club_id());

-- Cualquier coach puede crear y gestionar sus propias sesiones -- a
-- propósito SIN filtro de coach_teams, a diferencia de evaluaciones: acá
-- cualquier coach puede tomar asistencia de cualquier categoría.
create policy "training_sessions: coach manages own"
  on public.training_sessions for all
  to authenticated
  using (public.current_user_role() = 'coach' and created_by = auth.uid())
  with check (
    public.current_user_role() = 'coach'
    and created_by = auth.uid()
    and club_id = public.current_user_club_id()
  );

create policy "training_sessions: athlete reads own attendance sessions"
  on public.training_sessions for select
  to authenticated
  using (
    public.current_user_role() = 'deportista'
    and exists (
      select 1 from public.training_attendance ta
      where ta.training_session_id = training_sessions.id
        and ta.athlete_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.training_sessions to authenticated;

-- ----------------------------------------------------------------------------
-- RLS -- training_session_divisions
-- ----------------------------------------------------------------------------

alter table public.training_session_divisions enable row level security;

create policy "training_session_divisions: admin or owning coach write"
  on public.training_session_divisions for all
  to authenticated
  using (
    exists (
      select 1 from public.training_sessions ts
      where ts.id = training_session_divisions.training_session_id
        and (
          (public.current_user_role() = 'admin' and ts.club_id = public.current_user_club_id())
          or (public.current_user_role() = 'coach' and ts.created_by = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.training_sessions ts
      where ts.id = training_session_divisions.training_session_id
        and (
          (public.current_user_role() = 'admin' and ts.club_id = public.current_user_club_id())
          or (public.current_user_role() = 'coach' and ts.created_by = auth.uid())
        )
    )
  );

create policy "training_session_divisions: athlete reads own attendance sessions"
  on public.training_session_divisions for select
  to authenticated
  using (
    exists (
      select 1 from public.training_attendance ta
      where ta.training_session_id = training_session_divisions.training_session_id
        and ta.athlete_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.training_session_divisions to authenticated;

-- ----------------------------------------------------------------------------
-- RLS -- training_attendance
-- ----------------------------------------------------------------------------

alter table public.training_attendance enable row level security;

create policy "training_attendance: admin full access"
  on public.training_attendance for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.training_sessions ts
      where ts.id = training_attendance.training_session_id
        and ts.club_id = public.current_user_club_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.training_sessions ts
      where ts.id = training_attendance.training_session_id
        and ts.club_id = public.current_user_club_id()
    )
  );

-- El coach puede corregir presente/ausente de sesiones ya guardadas -- sin
-- auditoría especial, es un dato de menor peso que las estadísticas
-- oficiales de partido (acordado explícitamente).
create policy "training_attendance: coach manages own sessions"
  on public.training_attendance for all
  to authenticated
  using (
    public.current_user_role() = 'coach'
    and exists (
      select 1 from public.training_sessions ts
      where ts.id = training_attendance.training_session_id
        and ts.created_by = auth.uid()
    )
  )
  with check (
    public.current_user_role() = 'coach'
    and exists (
      select 1 from public.training_sessions ts
      where ts.id = training_attendance.training_session_id
        and ts.created_by = auth.uid()
    )
  );

create policy "training_attendance: athlete reads own"
  on public.training_attendance for select
  to authenticated
  using (public.current_user_role() = 'deportista' and athlete_id = auth.uid());

grant select, insert, update, delete on public.training_attendance to authenticated;
