-- ============================================================================
-- GRUPO E — evaluation_reports, evaluation_scores, evaluation_dofa (Anexo B)
-- ============================================================================

-- Catálogo de bloques/ítems, mismo patrón que stat_definitions: referencial
-- en vez de texto libre, para que el promedio por bloque sea un GROUP BY
-- confiable y no dependa de que el frontend escriba las claves siempre igual.
create table public.evaluation_blocks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort_order int not null
);

create table public.evaluation_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.evaluation_blocks (id),
  key text not null,
  label text not null,
  sort_order int not null,
  unique (block_id, key)
);

insert into public.evaluation_blocks (key, label, sort_order) values
  ('patin', 'Habilidades de patín', 1),
  ('control_puck', 'Control de puck', 2),
  ('pases', 'Tipos de pases', 3),
  ('disparos', 'Disparos', 4),
  ('contacto_cuerpo', 'Contacto con el cuerpo', 5),
  ('velocidad', 'Velocidad', 6),
  ('ataque', 'Ataque', 7),
  ('defensa', 'Defensa', 8);

insert into public.evaluation_items (block_id, key, label, sort_order)
select b.id, i.key, i.label, i.sort_order
from public.evaluation_blocks b
join (values
  ('patin', 'freno_controlado', 'Freno controlado (dos pies / un pie, frontal y atrás)', 1),
  ('patin', 'giros_controlados', 'Giros controlados', 2),
  ('patin', 'crossover_frontal_atras', 'Crossover frontal y atrás', 3),
  ('patin', 'patinaje_atras', 'Patinaje hacia atrás', 4),
  ('patin', 'pivots_frente_atras', 'Pivots frente/atrás', 5),

  ('control_puck', 'stickhandling', 'Stickhandling (lateral, diagonal, adelante-atrás, toe drag)', 1),
  ('control_puck', 'puck_protection', 'Puck protection', 2),
  ('control_puck', 'acelerar_puck_una_mano', 'Acelerar con el puck a una mano', 3),
  ('control_puck', 'control_disco_velocidad', 'Control de disco en velocidad (de frente, de espaldas)', 4),

  ('pases', 'forehand', 'Forehand', 1),
  ('pases', 'backhand', 'Backhand', 2),
  ('pases', 'saucer', 'Saucer', 3),
  ('pases', 'recepcion_pase', 'Recepción correcta del pase', 4),

  ('disparos', 'wrist_shot', 'Wrist shot', 1),
  ('disparos', 'backhand_shot', 'Backhand', 2),
  ('disparos', 'deflect_tipping', 'Deflect/tipping', 3),
  ('disparos', 'snap_shot', 'Snap shot', 4),
  ('disparos', 'slap_shot', 'Slap shot', 5),
  ('disparos', 'one_timer', 'One-timer', 6),

  ('contacto_cuerpo', 'stick_on_puck', 'Stick on puck', 1),
  ('contacto_cuerpo', 'stick_lift', 'Stick lift', 2),
  ('contacto_cuerpo', 'amarrar_bandas', 'Amarrar en bandas', 3),
  ('contacto_cuerpo', 'estabilidad_contacto', 'Estabilidad al recibir contacto', 4),

  ('velocidad', 'arranques', 'Arranques (frontal/crossover/espalda)', 1),
  ('velocidad', 'zig_zag', 'Zig-zag', 2),
  ('velocidad', 'one_lap', 'One lap', 3),
  ('velocidad', 'cuarenta_metros', '40 mts lineales', 4),

  ('ataque', 'pases_largos', 'Pases largos', 1),
  ('ataque', 'give_and_go', 'Give and go', 2),
  ('ataque', 'ocupar_espacios', 'Ocupar espacios vacíos', 3),
  ('ataque', 'pases_cruzados_ataque', 'Pases cruzados', 4),

  ('defensa', 'marcas', 'Marcas', 1),
  ('defensa', 'evitar_pases_cruzados', 'Evitar pases cruzados', 2),
  ('defensa', 'control_gap', 'Control del gap', 3),
  ('defensa', 'salir_presion', 'Salir de la presión', 4)
) as i(block_key, key, label, sort_order) on i.block_key = b.key;

create type public.dofa_quadrant as enum ('fortalezas', 'oportunidades', 'debilidades', 'amenazas');
create type public.dofa_subarea as enum ('defensivo', 'ofensivo', 'general', 'trabajo_equipo', 'comunicacion', 'autoconfianza');

create table public.evaluation_reports (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id),
  coach_id uuid not null references public.profiles (id),
  division_id uuid not null references public.divisions (id),
  report_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.evaluation_reports (id) on delete cascade,
  item_id uuid not null references public.evaluation_items (id),
  score smallint not null check (score between 1 and 5),
  notes text,
  unique (report_id, item_id)
);

create table public.evaluation_dofa (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.evaluation_reports (id) on delete cascade,
  quadrant public.dofa_quadrant not null,
  subarea public.dofa_subarea not null,
  notes text,
  unique (report_id, quadrant, subarea)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.evaluation_blocks enable row level security;
alter table public.evaluation_items enable row level security;

create policy "evaluation_blocks: any authenticated reads"
  on public.evaluation_blocks for select to authenticated using (true);

create policy "evaluation_items: any authenticated reads"
  on public.evaluation_items for select to authenticated using (true);

alter table public.evaluation_reports enable row level security;

create policy "evaluation_reports: admin full access"
  on public.evaluation_reports for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and athlete_id in (select id from public.profiles where club_id = public.current_user_club_id())
  )
  with check (
    public.current_user_role() = 'admin'
    and athlete_id in (select id from public.profiles where club_id = public.current_user_club_id())
  );

-- Coach: solo sus propios reportes (los que redactó él), y solo de un
-- deportista que esté en un equipo que él coordina (via coach_teams).
create policy "evaluation_reports: coach manages own reports"
  on public.evaluation_reports for all
  to authenticated
  using (
    public.current_user_role() = 'coach'
    and coach_id = auth.uid()
  )
  with check (
    public.current_user_role() = 'coach'
    and coach_id = auth.uid()
    and exists (
      select 1
      from public.roster_players rp
      join public.rosters r on r.id = rp.roster_id
      join public.coach_teams ct on ct.team_id = r.team_id
      where rp.athlete_id = evaluation_reports.athlete_id
        and ct.coach_id = auth.uid()
    )
  );

create policy "evaluation_reports: athlete reads own"
  on public.evaluation_reports for select
  to authenticated
  using (public.current_user_role() = 'deportista' and athlete_id = auth.uid());

-- evaluation_scores / evaluation_dofa: SELECT se resuelve preguntando si ya
-- se puede leer el report padre (misma lógica de lectura, sin duplicarla:
-- cubre admin, coach dueño, y deportista dueño). La escritura NO puede usar
-- el mismo truco de "existe el padre" porque el deportista también puede
-- *leer* su propio report — si reusáramos esa misma condición para todas las
-- operaciones, un deportista podría además insertar/editar/borrar sus
-- propias notas de evaluación. La escritura repite explícitamente la regla
-- de evaluation_reports (admin, o coach dueño del report).
alter table public.evaluation_scores enable row level security;

create policy "evaluation_scores: read if parent report is readable"
  on public.evaluation_scores for select
  to authenticated
  using (exists (select 1 from public.evaluation_reports er where er.id = evaluation_scores.report_id));

create policy "evaluation_scores: admin or owning coach write"
  on public.evaluation_scores for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_scores.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

create policy "evaluation_scores: admin or owning coach update"
  on public.evaluation_scores for update
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_scores.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_scores.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

create policy "evaluation_scores: admin or owning coach delete"
  on public.evaluation_scores for delete
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_scores.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

alter table public.evaluation_dofa enable row level security;

create policy "evaluation_dofa: read if parent report is readable"
  on public.evaluation_dofa for select
  to authenticated
  using (exists (select 1 from public.evaluation_reports er where er.id = evaluation_dofa.report_id));

create policy "evaluation_dofa: admin or owning coach write"
  on public.evaluation_dofa for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

create policy "evaluation_dofa: admin or owning coach update"
  on public.evaluation_dofa for update
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

create policy "evaluation_dofa: admin or owning coach delete"
  on public.evaluation_dofa for delete
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

grant select on public.evaluation_blocks to authenticated;
grant select on public.evaluation_items to authenticated;
grant select, insert, update, delete on public.evaluation_reports to authenticated;
grant select, insert, update, delete on public.evaluation_scores to authenticated;
grant select, insert, update, delete on public.evaluation_dofa to authenticated;
