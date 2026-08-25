-- ============================================================================
-- evaluation_scores.notes quedó definido como una nota por ÍTEM, pero el
-- formulario real que se pidió es una nota por BLOQUE (8 notas por reporte,
-- no 35). En vez de repurpuear esa columna, se agrega una tabla nueva --
-- evaluation_scores.notes queda sin usar desde el formulario nuevo, pero no
-- se borra (no hace daño, y borrar una columna existente sin necesidad es
-- más riesgo que beneficio).
-- ============================================================================

create table public.evaluation_block_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.evaluation_reports (id) on delete cascade,
  block_id uuid not null references public.evaluation_blocks (id),
  notes text,
  unique (report_id, block_id)
);

alter table public.evaluation_block_notes enable row level security;

-- Mismo patrón que evaluation_scores: lectura amplia (cualquiera que pueda
-- leer el report padre), escritura solo admin o el coach dueño del report.
create policy "evaluation_block_notes: read if parent report is readable"
  on public.evaluation_block_notes for select
  to authenticated
  using (exists (select 1 from public.evaluation_reports er where er.id = evaluation_block_notes.report_id));

create policy "evaluation_block_notes: admin or owning coach insert"
  on public.evaluation_block_notes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_block_notes.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

create policy "evaluation_block_notes: admin or owning coach update"
  on public.evaluation_block_notes for update
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_block_notes.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_block_notes.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

create policy "evaluation_block_notes: admin or owning coach delete"
  on public.evaluation_block_notes for delete
  to authenticated
  using (
    exists (
      select 1 from public.evaluation_reports er
      where er.id = evaluation_block_notes.report_id
        and (
          (public.current_user_role() = 'admin' and er.athlete_id in (select id from public.profiles where club_id = public.current_user_club_id()))
          or (public.current_user_role() = 'coach' and er.coach_id = auth.uid())
        )
    )
  );

grant select, insert, update, delete on public.evaluation_block_notes to authenticated;
