'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/coach/evaluations';

async function requireCoach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'coach') redirect('/dashboard?error=unauthorized');

  return { supabase, coachId: user.id };
}

// $ el name attribute de cada campo codifica a qué pertenece
// (score_<item_id>, block_notes_<block_id>, dofa_<quadrant>_<subarea>) --
// así el form no necesita mandar la lista de bloques/ítems por separado.
function parseForm(formData: FormData) {
  const scores: { item_id: string; score: number }[] = [];
  const blockNotes: { block_id: string; notes: string }[] = [];
  const dofa: { quadrant: string; subarea: string; notes: string }[] = [];

  for (const [key, rawValue] of formData.entries()) {
    const value = String(rawValue);
    if (key.startsWith('score_')) {
      scores.push({ item_id: key.slice('score_'.length), score: Number(value) });
    } else if (key.startsWith('block_notes_')) {
      blockNotes.push({ block_id: key.slice('block_notes_'.length), notes: value });
    } else if (key.startsWith('dofa_')) {
      const rest = key.slice('dofa_'.length);
      const idx = rest.indexOf('_');
      dofa.push({ quadrant: rest.slice(0, idx), subarea: rest.slice(idx + 1), notes: value });
    }
  }

  return { scores, blockNotes, dofa };
}

export async function createEvaluation(formData: FormData) {
  const { supabase, coachId } = await requireCoach();

  const athlete_id = formData.get('athlete_id') as string;
  const division_id = formData.get('division_id') as string;

  if (!athlete_id || !division_id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Falta el deportista o la división.')}`);
  }

  const { data: report, error: reportError } = await supabase
    .from('evaluation_reports')
    .insert({ athlete_id, coach_id: coachId, division_id })
    .select('id')
    .single();

  if (reportError) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(reportError.message)}`);
  }

  const { scores, blockNotes, dofa } = parseForm(formData);

  const { error: scoresError } = await supabase
    .from('evaluation_scores')
    .insert(scores.map((s) => ({ report_id: report.id, item_id: s.item_id, score: s.score })));
  if (scoresError) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(scoresError.message)}`);
  }

  const { error: notesError } = await supabase
    .from('evaluation_block_notes')
    .insert(blockNotes.map((b) => ({ report_id: report.id, block_id: b.block_id, notes: b.notes })));
  if (notesError) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(notesError.message)}`);
  }

  const { error: dofaError } = await supabase
    .from('evaluation_dofa')
    .insert(dofa.map((d) => ({ report_id: report.id, quadrant: d.quadrant, subarea: d.subarea, notes: d.notes })));
  if (dofaError) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(dofaError.message)}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`/dashboard/evaluations/${report.id}`);
}

export async function updateEvaluation(formData: FormData) {
  const { supabase } = await requireCoach();

  const report_id = formData.get('report_id') as string;
  if (!report_id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Falta el reporte.')}`);
  }

  const { scores, blockNotes, dofa } = parseForm(formData);

  await supabase.from('evaluation_scores').delete().eq('report_id', report_id);
  const { error: scoresError } = await supabase
    .from('evaluation_scores')
    .insert(scores.map((s) => ({ report_id, item_id: s.item_id, score: s.score })));
  if (scoresError) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(scoresError.message)}`);
  }

  await supabase.from('evaluation_block_notes').delete().eq('report_id', report_id);
  const { error: notesError } = await supabase
    .from('evaluation_block_notes')
    .insert(blockNotes.map((b) => ({ report_id, block_id: b.block_id, notes: b.notes })));
  if (notesError) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(notesError.message)}`);
  }

  await supabase.from('evaluation_dofa').delete().eq('report_id', report_id);
  const { error: dofaError } = await supabase
    .from('evaluation_dofa')
    .insert(dofa.map((d) => ({ report_id, quadrant: d.quadrant, subarea: d.subarea, notes: d.notes })));
  if (dofaError) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(dofaError.message)}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`/dashboard/evaluations/${report_id}`);
}
