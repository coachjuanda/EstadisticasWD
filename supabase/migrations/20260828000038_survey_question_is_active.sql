-- ============================================================================
-- Permite desactivar una pregunta de encuesta sin borrarla: necesario para
-- poder editar plantillas ya en uso sin perder el historial de respuestas
-- de preguntas que ya no deben seguir apareciendo.
-- ============================================================================

alter table public.survey_questions
  add column is_active boolean not null default true;
