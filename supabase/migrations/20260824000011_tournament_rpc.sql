-- ============================================================================
-- Crear/editar un torneo toca 3 tablas a la vez (tournaments,
-- tournament_divisions, tournament_stat_config). Sin una función, serían 3+
-- llamadas HTTP separadas desde el cliente -- si la segunda o tercera falla,
-- queda un torneo a medias (sin divisiones o sin config de estadísticas).
-- Estas funciones envuelven todo en una sola transacción.
--
-- SECURITY INVOKER (el default, explícito acá): corren con los privilegios
-- de quien llama, así que las policies de RLS de admin siguen aplicando
-- normalmente en cada INSERT/UPDATE/DELETE interno -- si alguien sin rol
-- admin llamara esto igual, cada statement fallaría por RLS y la transacción
-- entera se revierte.
-- ============================================================================

create or replace function public.create_tournament_with_config(
  p_name text,
  p_league_id uuid,
  p_start_date date,
  p_end_date date,
  p_division_ids uuid[],
  p_stat_definition_ids uuid[]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_club_id uuid;
  v_tournament_id uuid;
  v_division_id uuid;
  v_stat_id uuid;
begin
  select club_id into v_club_id from public.profiles where id = auth.uid();

  insert into public.tournaments (club_id, league_id, name, start_date, end_date)
  values (v_club_id, p_league_id, p_name, p_start_date, p_end_date)
  returning id into v_tournament_id;

  foreach v_division_id in array p_division_ids loop
    insert into public.tournament_divisions (tournament_id, division_id)
    values (v_tournament_id, v_division_id);
  end loop;

  foreach v_stat_id in array p_stat_definition_ids loop
    insert into public.tournament_stat_config (tournament_id, stat_definition_id, enabled)
    values (v_tournament_id, v_stat_id, true);
  end loop;

  return v_tournament_id;
end;
$$;

create or replace function public.update_tournament_with_config(
  p_tournament_id uuid,
  p_name text,
  p_league_id uuid,
  p_start_date date,
  p_end_date date,
  p_division_ids uuid[],
  p_stat_definition_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_division_id uuid;
  v_stat_id uuid;
begin
  update public.tournaments
  set name = p_name, league_id = p_league_id, start_date = p_start_date, end_date = p_end_date
  where id = p_tournament_id;

  delete from public.tournament_divisions where tournament_id = p_tournament_id;
  foreach v_division_id in array p_division_ids loop
    insert into public.tournament_divisions (tournament_id, division_id)
    values (p_tournament_id, v_division_id);
  end loop;

  delete from public.tournament_stat_config where tournament_id = p_tournament_id;
  foreach v_stat_id in array p_stat_definition_ids loop
    insert into public.tournament_stat_config (tournament_id, stat_definition_id, enabled)
    values (p_tournament_id, v_stat_id, true);
  end loop;
end;
$$;

grant execute on function public.create_tournament_with_config(text, uuid, date, date, uuid[], uuid[]) to authenticated;
grant execute on function public.update_tournament_with_config(uuid, text, uuid, date, date, uuid[], uuid[]) to authenticated;
