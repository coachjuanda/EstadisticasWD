-- ============================================================================
-- Extiende el motor genérico de encuestas: descripción de la plantilla,
-- rango configurable para 'escala' (default 1-5, no rompe lo existente) y
-- preguntas opcionales. Disparado por la necesidad de una pregunta NPS 0-10
-- y un comentario libre opcional.
-- ============================================================================

alter table public.survey_templates
  add column description text;

alter table public.survey_questions
  add column scale_min int not null default 1,
  add column scale_max int not null default 5,
  add column is_required boolean not null default true;

alter table public.survey_questions
  add constraint survey_questions_scale_range_check check (scale_max > scale_min);
