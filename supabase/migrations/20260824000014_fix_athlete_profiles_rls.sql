-- ============================================================================
-- FIX — "athlete_profiles: club members read" (migración 3) hacía:
--   id in (select id from public.profiles where club_id = current_user_club_id())
-- Ese subquery contra public.profiles corre sujeto a las RLS policies de
-- profiles mismas (no es security definer), y profiles solo permite
-- auto-lectura o lectura de admin -- nunca "cualquier miembro del club". El
-- resultado: para cualquier rol no-admin (coach, scorekeeper, deportista) el
-- subquery devuelve casi nada, y la policy bloquea el acceso que se
-- pretendía dar. Nunca se detectó porque toda la sesión se probó como admin
-- (cuyo propio "profiles: admin reads own club" sí es lo bastante amplio
-- como para que el subquery funcionara, ocultando el bug).
--
-- Fix: un helper security definer, mismo patrón que current_user_club_id().
-- ============================================================================

create or replace function public.profile_in_my_club(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and p.club_id = (select club_id from public.profiles where id = auth.uid())
  );
$$;

drop policy "athlete_profiles: club members read" on public.athlete_profiles;

create policy "athlete_profiles: club members read"
  on public.athlete_profiles for select
  to authenticated
  using (public.profile_in_my_club(id));
