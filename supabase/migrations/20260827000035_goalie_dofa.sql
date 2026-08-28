-- ============================================================================
-- DOFA de portero: estructura distinta a la de jugador de campo. En vez de
-- 4 cuadrantes × 6 sub-áreas (evaluation_dofa), el portero tiene 4 ítems de
-- texto libre (Oportunidades de mejora, Fortalezas, Aprendizajes, Metas),
-- también duplicados por deporte (línea/hielo) igual que el de campo.
--
-- Se modela en una tabla nueva en vez de forzar la de jugador de campo con
-- columnas nulleables -- son dos estructuras conceptualmente distintas
-- (cuadrante×sub-área vs. ítem suelto), no una generalización de la otra.
--
-- Toda la data de evaluation_reports hasta ahora es de prueba -- se borra
-- (cascada a evaluation_scores/evaluation_dofa/evaluation_block_notes) antes
-- de cambiar el esquema, como ya se acordó en el ajuste anterior.
-- ============================================================================

delete from public.evaluation_reports;

create type public.dofa_goalie_item as enum ('oportunidades_mejora', 'fortalezas', 'aprendizajes', 'metas');

create table public.evaluation_goalie_dofa (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.evaluation_reports (id) on delete cascade,
  sport public.sport not null,
  item public.dofa_goalie_item not null,
  notes text,
  unique (report_id, sport, item)
);

alter table public.evaluation_goalie_dofa enable row level security;

-- Mismo patrón que evaluation_dofa: lectura amplia (cualquiera que pueda leer
-- el report padre), escritura solo admin o el coach dueño del report.
create policy "evaluation_goalie_dofa: read if parent report is readable"
  on public.evaluation_goalie_dofa for select
  to authenticated
  using (exists (select 1 from public.evaluation_reports er where er.id = evaluation_goalie_dofa.report_id));

create policy "evaluation_goalie_dofa: admin or owning coach insert"
  on public.evaluation_goalie_dofa for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_goalie_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

create policy "evaluation_goalie_dofa: admin or owning coach update"
  on public.evaluation_goalie_dofa for update
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_goalie_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_goalie_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

create policy "evaluation_goalie_dofa: admin or owning coach delete"
  on public.evaluation_goalie_dofa for delete
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_goalie_dofa.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

grant select, insert, update, delete on public.evaluation_goalie_dofa to authenticated;
