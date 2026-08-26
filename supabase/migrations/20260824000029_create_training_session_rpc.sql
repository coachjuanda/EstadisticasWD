-- ============================================================================
-- create_training_session: crea la sesión + sus divisiones + toda la
-- asistencia convocada en una sola llamada, tal como se acordó ("un solo
-- submit crea todo en una transacción"). SECURITY INVOKER a propósito (el
-- default): cada INSERT interno sigue sujeto a las RLS normales de cada
-- tabla (con check de training_sessions/training_session_divisions/
-- training_attendance) -- lo único que da la función es que las 3 tablas se
-- escriben en una sola transacción implícita, no un bypass de permisos.
-- ============================================================================

create or replace function public.create_training_session(
  p_scheduled_at timestamptz,
  p_location text,
  p_division_ids uuid[],
  p_attendance jsonb -- [{"athlete_id": "...", "present": true}, ...]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_club_id uuid;
  v_session_id uuid;
  v_division_id uuid;
  v_entry jsonb;
begin
  select club_id into v_club_id from public.profiles where id = auth.uid();

  insert into public.training_sessions (club_id, created_by, scheduled_at, location)
  values (v_club_id, auth.uid(), p_scheduled_at, nullif(p_location, ''))
  returning id into v_session_id;

  foreach v_division_id in array p_division_ids loop
    insert into public.training_session_divisions (training_session_id, division_id)
    values (v_session_id, v_division_id);
  end loop;

  for v_entry in select * from jsonb_array_elements(p_attendance) loop
    insert into public.training_attendance (training_session_id, athlete_id, present)
    values (v_session_id, (v_entry ->> 'athlete_id')::uuid, (v_entry ->> 'present')::boolean);
  end loop;

  return v_session_id;
end;
$$;

grant execute on function public.create_training_session(timestamptz, text, uuid[], jsonb) to authenticated;
