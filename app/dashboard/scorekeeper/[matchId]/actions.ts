'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// "Ni siquiera otro scorekeeper" puede tocar un partido que no es suyo --
// esto se repite en cada acción a propósito (Server Functions son
// alcanzables por POST directo, no solo desde la UI, así que cada una
// verifica dueño del partido por su cuenta en vez de confiar en que la
// pantalla no muestre el botón).
async function requireOwnMatch(matchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: match } = await supabase
    .from('matches')
    .select('id, status, scorekeeper_id')
    .eq('id', matchId)
    .single();

  if (!match || match.scorekeeper_id !== user.id) {
    redirect('/dashboard?error=unauthorized');
  }

  return { supabase, match };
}

export async function startMatch(formData: FormData) {
  const matchId = formData.get('match_id') as string;
  const { supabase, match } = await requireOwnMatch(matchId);

  if (match.status !== 'programado') {
    redirect(`/dashboard/scorekeeper/${matchId}`);
  }

  const { error } = await supabase.from('matches').update({ status: 'en_vivo' }).eq('id', matchId);

  if (error) {
    redirect(`/dashboard/scorekeeper/${matchId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/dashboard/scorekeeper/${matchId}`);
}
