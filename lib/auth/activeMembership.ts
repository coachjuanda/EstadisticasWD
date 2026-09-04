import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export type UserRole = 'admin' | 'coach' | 'scorekeeper' | 'deportista';

export type ActiveMembership = {
  personId: string;
  fullName: string;
  email: string;
  cedula: string;
  status: 'activo' | 'inactivo';
  membershipId: string;
  role: UserRole;
  clubId: string;
};

type PeopleWithActiveMembershipRow = {
  id: string;
  full_name: string;
  email: string;
  cedula: string;
  status: 'activo' | 'inactivo';
  active_membership: { id: string; role: UserRole; club_id: string } | null;
};

// Resuelve la persona autenticada + su membership activa (rol/club de la
// sesión) en una sola consulta. people.active_membership_id -> memberships
// es una relación distinta de memberships.person_id -> people.id (hay dos
// caminos entre las mismas dos tablas), así que el hint del nombre del
// constraint es obligatorio para que PostgREST no la rechace por ambigua.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActiveMembership(supabase: SupabaseClient<any>): Promise<ActiveMembership | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('people')
    .select(
      'id, full_name, email, cedula, status, active_membership:memberships!people_active_membership_id_fkey(id, role, club_id)'
    )
    .eq('id', user.id)
    .maybeSingle<PeopleWithActiveMembershipRow>();

  if (!data || !data.active_membership) return null;

  return {
    personId: data.id,
    fullName: data.full_name,
    email: data.email,
    cedula: data.cedula,
    status: data.status,
    membershipId: data.active_membership.id,
    role: data.active_membership.role,
    clubId: data.active_membership.club_id,
  };
}

export type MembershipOption = { id: string; role: UserRole; club_id: string };

// Todos los roles de la persona autenticada. OJO: el filtro por person_id
// acá es obligatorio, no cosmético -- "memberships: admin manages own club"
// (RLS) deja a un admin leer TODAS las membresías de su club, no solo la
// suya, porque en otras pantallas eso es justo lo que se necesita. Confiar
// solo en RLS acá haría que un admin viera el selector de rol de CUALQUIER
// persona del club, no el propio.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMemberships(supabase: SupabaseClient<any>): Promise<MembershipOption[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('memberships')
    .select('id, role, club_id')
    .eq('person_id', user.id)
    .order('role');
  return data ?? [];
}

// Reemplaza los guards locales tipo "requireAdmin"/"requireCoach" repetidos
// por archivo: si no hay sesión, a /login; si el rol activo no coincide, a
// /dashboard con el mismo error de siempre.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireRole(supabase: SupabaseClient<any>, role: UserRole): Promise<ActiveMembership> {
  const membership = await getActiveMembership(supabase);
  if (!membership) {
    redirect('/login');
  }
  if (membership.role !== role) {
    redirect('/dashboard?error=unauthorized');
  }
  return membership;
}

export type PersonOption = { id: string; full_name: string; cedula: string };

type PersonEmbedRow = {
  people: { id: string; full_name: string; cedula: string; status: 'activo' | 'inactivo' } | null;
};

// Reemplaza "select id, full_name from profiles where role = X" (listas de
// deportistas/coaches/scorekeepers para selects y filtros). RLS de
// memberships ("admin manages own club" / "self read") ya acota el
// resultado al club de quien pregunta, igual que antes con profiles.
//
// El hint `!memberships_person_id_fkey` es obligatorio: memberships y people
// tienen DOS relaciones (person_id -> people.id, y people.active_membership_id
// -> memberships.id), así que PostgREST rechaza el embed sin desambiguar
// (PGRST201) si se pide solo "people(...)".
export async function getPeopleByRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  role: UserRole,
  opts?: { activeOnly?: boolean }
): Promise<PersonOption[]> {
  const { data } = await supabase
    .from('memberships')
    .select('people!memberships_person_id_fkey(id, full_name, cedula, status)')
    .eq('role', role)
    .returns<PersonEmbedRow[]>();

  let people = (data ?? [])
    .map((row) => row.people)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (opts?.activeOnly) {
    people = people.filter((p) => p.status === 'activo');
  }

  return people
    .map((p) => ({ id: p.id, full_name: p.full_name, cedula: p.cedula }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}
