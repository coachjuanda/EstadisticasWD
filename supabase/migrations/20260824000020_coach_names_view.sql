-- ============================================================================
-- FIX — la migración anterior (19) resolvió "el deportista no ve el nombre
-- del coach" abriendo lectura de la FILA COMPLETA de profiles (nombre,
-- email, cédula) para cualquier coach a cualquier miembro del club. Eso es
-- más de lo que hace falta: solo se necesita el nombre. Se reemplaza por una
-- vista reducida que expone únicamente (id, full_name), y se revierte la
-- policy de fila completa -- profiles vuelve a ser solo auto-lectura o
-- lectura de admin.
--
-- Igual que las vistas public_* (matches en vivo), esta vista NO lleva
-- security_invoker: corre con los privilegios de quien la creó (bypassa RLS
-- de profiles), pero su propio WHERE sigue evaluando current_user_club_id()
-- con el auth.uid() real de quien hace la consulta -- así que sigue acotada
-- al club de quien pregunta, no expone coaches de otros clubes.
-- ============================================================================

drop policy "profiles: club members read coach names" on public.profiles;

create or replace view public.coach_names as
select id, full_name
from public.profiles
where role = 'coach' and club_id = public.current_user_club_id();

grant select on public.coach_names to authenticated;
revoke all on public.coach_names from anon;
