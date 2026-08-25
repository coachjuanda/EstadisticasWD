import { createClient } from '@/lib/supabase/server';
import { CreateUserForm } from './CreateUserForm';
import { UsersTable } from './UsersTable';

type ProfileQueryRow = {
  id: string;
  full_name: string;
  cedula: string;
  email: string;
  role: string;
  status: string;
  athlete_profiles: { position: string | null } | null;
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

  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, cedula, email, role, status, athlete_profiles(position)')
    .order('full_name');

  if (roleFilter) {
    profilesQuery = profilesQuery.eq('role', roleFilter);
  }

  const [{ data: profiles }, { data: teams }, { data: coachTeams }] = await Promise.all([
    profilesQuery.returns<ProfileQueryRow[]>(),
    supabase.from('teams').select('id, name, divisions(name)').order('name').returns<TeamRow[]>(),
    supabase.from('coach_teams').select('coach_id, team_id'),
  ]);

  const profileList = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    cedula: p.cedula,
    email: p.email,
    role: p.role,
    status: p.status,
    position: p.athlete_profiles?.position ?? null,
  }));

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
