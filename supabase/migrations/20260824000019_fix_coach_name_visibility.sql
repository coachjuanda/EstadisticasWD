-- ============================================================================
-- FIX — profiles solo tiene "self read" y "admin reads own club" como
-- policies de SELECT. Eso significa que nadie más que el propio coach (o un
-- admin) puede leer su fila de profiles -- así que cualquier pantalla que
-- necesite mostrar "Evaluado por <nombre del coach>" (la vista de detalle de
-- evaluación, la lista del deportista) le sale en blanco a cualquiera que no
-- sea admin. Mismo patrón de bug que "athlete_profiles: club members read"
-- (migración 14), esta vez sobre profiles.
--
-- Fix acotado a propósito: solo abre lectura de filas con role='coach' a
-- cualquier miembro del club (no abre profiles de deportista/scorekeeper/
-- admin, que si queremos mantener más cerrados). Esto expone el nombre --
-- pero también email y cédula del coach vía esa fila, a cualquiera del
-- club -- si eso resulta demasiado, la alternativa es una vista con solo
-- (id, full_name) en vez de esta policy a nivel de fila completa.
-- ============================================================================

create policy "profiles: club members read coach names"
  on public.profiles for select
  to authenticated
  using (role = 'coach' and public.profile_in_my_club(id));
