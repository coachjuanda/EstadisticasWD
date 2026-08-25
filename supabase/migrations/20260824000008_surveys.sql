-- ============================================================================
-- GRUPO F — survey_templates, survey_questions, survey_responses,
-- survey_answers. Genérico a propósito: el brief deja el formato final
-- pendiente, así que el constructor de preguntas es configurable.
-- ============================================================================

create type public.survey_target as enum ('deportista', 'padre');
create type public.question_type as enum ('escala', 'opcion_multiple', 'texto_libre');

create table public.survey_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  title text not null,
  target public.survey_target not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.survey_templates (id) on delete cascade,
  question_text text not null,
  question_type public.question_type not null,
  -- Para 'opcion_multiple': ["Opción A", "Opción B", ...]. Null en los demás
  -- tipos (una escala 1-5 no necesita listar sus opciones, es implícita).
  options jsonb,
  sort_order int not null
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.survey_templates (id),
  user_id uuid not null references public.profiles (id),
  submitted_at timestamptz not null default now(),
  unique (template_id, user_id)
);

create table public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  question_id uuid not null references public.survey_questions (id),
  -- jsonb en vez de una columna por tipo: un número para 'escala', texto para
  -- 'texto_libre', el string de la opción elegida para 'opcion_multiple'.
  answer_value jsonb not null,
  unique (response_id, question_id)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.survey_templates enable row level security;

create policy "survey_templates: admin full access"
  on public.survey_templates for all
  to authenticated
  using (public.current_user_role() = 'admin' and club_id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and club_id = public.current_user_club_id());

-- Coach/scorekeeper no necesitan ver encuestas — solo admin (las gestiona) y
-- deportista (las responde, cuenta compartida con el padre/acudiente).
create policy "survey_templates: athlete reads own club"
  on public.survey_templates for select
  to authenticated
  using (public.current_user_role() = 'deportista' and club_id = public.current_user_club_id());

alter table public.survey_questions enable row level security;

create policy "survey_questions: read if parent template is readable"
  on public.survey_questions for select
  to authenticated
  using (exists (select 1 from public.survey_templates st where st.id = survey_questions.template_id));

create policy "survey_questions: admin writes"
  on public.survey_questions for all
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.survey_templates st
      where st.id = survey_questions.template_id
        and st.club_id = public.current_user_club_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.survey_templates st
      where st.id = survey_questions.template_id
        and st.club_id = public.current_user_club_id()
    )
  );

alter table public.survey_responses enable row level security;

create policy "survey_responses: athlete manages own"
  on public.survey_responses for all
  to authenticated
  using (public.current_user_role() = 'deportista' and user_id = auth.uid())
  with check (public.current_user_role() = 'deportista' and user_id = auth.uid());

create policy "survey_responses: admin reads own club"
  on public.survey_responses for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and template_id in (select id from public.survey_templates where club_id = public.current_user_club_id())
  );

alter table public.survey_answers enable row level security;

create policy "survey_answers: athlete manages own"
  on public.survey_answers for all
  to authenticated
  using (
    exists (
      select 1 from public.survey_responses sr
      where sr.id = survey_answers.response_id
        and sr.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.survey_responses sr
      where sr.id = survey_answers.response_id
        and sr.user_id = auth.uid()
    )
  );

create policy "survey_answers: admin reads own club"
  on public.survey_answers for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1
      from public.survey_responses sr
      join public.survey_templates st on st.id = sr.template_id
      where sr.id = survey_answers.response_id
        and st.club_id = public.current_user_club_id()
    )
  );

grant select, insert, update, delete on public.survey_templates to authenticated;
grant select on public.survey_questions to authenticated;
grant insert, update, delete on public.survey_questions to authenticated;
grant select, insert, update, delete on public.survey_responses to authenticated;
grant select, insert, update, delete on public.survey_answers to authenticated;
