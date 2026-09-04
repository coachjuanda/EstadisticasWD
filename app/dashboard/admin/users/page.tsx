import { createClient } from '@/lib/supabase/server';
import { CreateUserForm } from './CreateUserForm';
import { UsersTable } from './UsersTable';

type MembershipQueryRow = {
  role: string;
  people: {
    id: string;
    full_name: string;
    cedula: string;
    email: string;
    status: string;
    athlete_profiles: { position: string | null } | null;
  } | null;
};

type TeamRow = { id: string; name: string; divisions: { name: string } | null };

const ROLE_FILTERS = [
  { value: undefined, label: 'Todos' },
  { value: 'admin', label: 'Admin' },
  { value: 'coach', label: 'Coach' },
  { value: 'scorekeeper', label: 'Scorekeeper' },
  { value: 'deportista', label: 'Deportista' },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string; assign?: string; role?: string }>;
}) {
  const { error, edit, assign, role: roleFilter } = await searchParams;
  const supabase = await createClient();

  // Hint !memberships_person_id_fkey obligatorio -- memberships y people
  // tienen 2 relaciones (ver también lib/auth/activeMembership.ts), y sin
  // desambiguar PostgREST rechaza el embed con PGRST201.
  //
  // Sin filtro por rol acá a propósito: una persona con 2+ roles necesita
  // traer TODAS sus membresías para mostrarse en una sola fila con todas sus
  // etiquetas, así que el filtro de la UI se aplica después de agrupar, no
  // en la query (el club es chico, filtrar en memoria no pesa).
  const [{ data: memberships }, { data: teams }, { data: coachTeams }] = await Promise.all([
    supabase
      .from('memberships')
      .select('role, people!memberships_person_id_fkey(id, full_name, cedula, email, status, athlete_profiles(position))')
      .order('full_name', { referencedTable: 'people' })
      .returns<MembershipQueryRow[]>(),
    supabase.from('teams').select('id, name, divisions(name)').order('name').returns<TeamRow[]>(),
    supabase.from('coach_teams').select('coach_id, team_id'),
  ]);

  // Una fila por PERSONA (no por membership): agrupa todos los roles de cada
  // quien en el mismo registro, en vez de mostrarla duplicada una vez por
  // rol -- confuso en cuanto alguien tiene 2+ roles, que ya es el caso real
  // para varias personas del club.
  type Person = {
    id: string;
    full_name: string;
    cedula: string;
    email: string;
    roles: string[];
    status: string;
    position: string | null;
  };
  const peopleById = new Map<string, Person>();
  for (const m of memberships ?? []) {
    if (!m.people) continue;
    const existing = peopleById.get(m.people.id);
    if (existing) {
      existing.roles.push(m.role);
    } else {
      peopleById.set(m.people.id, {
        id: m.people.id,
        full_name: m.people.full_name,
        cedula: m.people.cedula,
        email: m.people.email,
        roles: [m.role],
        status: m.people.status,
        position: m.people.athlete_profiles?.position ?? null,
      });
    }
  }

  const profileList = Array.from(peopleById.values()).filter((p) => !roleFilter || p.roles.includes(roleFilter));

  const teamList = teams ?? [];
  const teamOptions = teamList.map((t) => ({ id: t.id, name: t.name, divisionName: t.divisions?.name ?? null }));

  const coachTeamsByCoach: Record<string, string[]> = {};
  for (const row of coachTeams ?? []) {
    if (!coachTeamsByCoach[row.coach_id]) coachTeamsByCoach[row.coach_id] = [];
    coachTeamsByCoach[row.coach_id].push(row.team_id);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Usuarios</h1>
        <a
          href="/dashboard/admin/users/bulk"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
        >
          Carga masiva
        </a>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3 text-sm">
        {ROLE_FILTERS.map((f) => (
          <a
            key={f.label}
            href={f.value ? `/dashboard/admin/users?role=${f.value}` : '/dashboard/admin/users'}
            className={
              (f.value ?? undefined) === roleFilter || (!f.value && !roleFilter)
                ? 'font-semibold text-brand-blue'
                : 'text-neutral-500 hover:underline'
            }
          >
            {f.label}
          </a>
        ))}
      </div>

      <UsersTable
        profiles={profileList}
        teamOptions={teamOptions}
        coachTeamsByCoach={coachTeamsByCoach}
        editId={edit}
        assignId={assign}
      />

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">Crear nuevo usuario</h2>
      <div className="mt-3">
        <CreateUserForm teams={teamOptions} />
      </div>
    </div>
  );
}
