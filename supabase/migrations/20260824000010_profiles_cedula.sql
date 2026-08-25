-- ============================================================================
-- Login por cédula: cada profile lleva su número de identificación, usado
-- como identificador de login en vez de email (Supabase Auth sigue
-- funcionando con email por dentro — el login por cédula resuelve
-- cedula -> email en el servidor, nunca consultando profiles desde el
-- navegador).
-- ============================================================================

alter table public.profiles add column cedula text not null unique;

-- handle_new_user ahora también puebla cedula desde raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, club_id, role, full_name, email, cedula, status)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'club_id')::uuid,
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'cedula',
    'activo'
  );
  return new;
end;
$$;
