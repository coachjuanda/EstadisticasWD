import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { NewTrainingSessionForm } from './NewTrainingSessionForm';

type DivisionRow = { id: string; name: string };
type TeamRow = { id: string; division_id: string };
type MemberRow = {
  team_id: string;
  athlete_id: string;
  athlete_profiles: { full_name: string } | null;
};
type CoachRow = { id: string; full_name: string };

export default async function NewTrainingSessionPage() {
  const supabase = await createClient();

  const [{ data: divisions }, { data: teams }, { data: members }, { data: coaches }] = await Promise.all([
    supabase.from('divisions').select('id, name').order('name').returns<DivisionRow[]>(),
    supabase.from('teams').select('id, division_id').returns<TeamRow[]>(),
    supabase
      .from('team_members')
      .select('team_id, athlete_id, athlete_profiles(full_name)')
      .returns<MemberRow[]>(),
    supabase.from('active_coach_options').select('id, full_name').order('full_name').returns<CoachRow[]>(),
  ]);

  const teamsByDivision = new Map<string, string[]>();
  for (const t of teams ?? []) {
    if (!teamsByDivision.has(t.division_id)) teamsByDivision.set(t.division_id, []);
    teamsByDivision.get(t.division_id)!.push(t.id);
  }

  const membersByTeam = new Map<string, { id: string; full_name: string }[]>();
  for (const m of members ?? []) {
    if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
    membersByTeam.get(m.team_id)!.push({ id: m.athlete_id, full_name: m.athlete_profiles?.full_name ?? '—' });
  }

  const divisionOptions = (divisions ?? [])
    .map((d) => {
      const teamIds = teamsByDivision.get(d.id) ?? [];
      const seen = new Map<string, { id: string; full_name: string }>();
      for (const teamId of teamIds) {
        for (const athlete of membersByTeam.get(teamId) ?? []) {
          seen.set(athlete.id, athlete);
        }
      }
      return {
        id: d.id,
        name: d.name,
        athletes: [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
      };
    })
    .filter((d) => d.athletes.length > 0);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <NewTrainingSessionForm divisions={divisionOptions} coaches={coaches ?? []} />
      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
