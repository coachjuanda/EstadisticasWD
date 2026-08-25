-- ============================================================================
-- FIX — clubs se quedó sin RLS desde el stub original (20260824000001).
-- La creación del club en sí (alta de un nuevo club) no pasa por el rol
-- `authenticated`: es una acción de puesta en marcha que se hace directo
-- contra la base (o service_role), igual que en este MVP de un solo club —
-- por eso no hay policy de INSERT/DELETE para authenticated aquí.
-- ============================================================================

alter table public.clubs enable row level security;

create policy "clubs: members read own club"
  on public.clubs for select
  to authenticated
  using (id = public.current_user_club_id());

create policy "clubs: admin updates own club"
  on public.clubs for update
  to authenticated
  using (public.current_user_role() = 'admin' and id = public.current_user_club_id())
  with check (public.current_user_role() = 'admin' and id = public.current_user_club_id());

grant select, update on public.clubs to authenticated;
revoke insert, delete on public.clubs from authenticated;
