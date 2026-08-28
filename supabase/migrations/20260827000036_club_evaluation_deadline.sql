-- ============================================================================
-- Fecha límite de entrega de evaluaciones, a nivel de club. Cuando está
-- fijada, el semáforo de vencimiento de TODOS los deportistas se calcula
-- contra esa fecha en vez de la regla individual (última evaluación + 2
-- meses). NULL = sin fecha fijada, se usa la regla individual.
--
-- No hace falta RLS nueva: "clubs: members read own club" ya deja leerla a
-- cualquier miembro (coaches incluidos) y "clubs: admin updates own club" ya
-- deja que solo el admin la fije/quite.
-- ============================================================================

alter table public.clubs
  add column evaluation_deadline date;
