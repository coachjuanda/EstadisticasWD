'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/activeMembership';

const BASE_PATH = '/dashboard/coach/evaluations';

async function requireCoach() {
  const supabase = await createClient();
  const membership = await requireRole(supabase, 'coach');

  return { supabase, coachId: membership.personId };
}

const DOFA_SPORT_PREFIXES = ['hockey_linea_', 'hockey_hielo_'];

// $ el name attribute de cada campo codifica a qué pertenece
// (score_<item_id>, block_notes_<block_id>, dofa_<sport>_<quadrant>_<subarea>,
// dofa_portero_<sport>_<item>) -- así el form no necesita mandar la lista de
// bloques/ítems por separado. sport siempre es "hockey_linea" o
// "hockey_hielo" (prefijo fijo, ambos con guion bajo interno), por eso se
// hace match por prefijo en vez de split. El prefijo "dofa_portero_" se
// revisa antes que "dofa_" (genérico de jugador de campo) porque también
// empieza por ese texto.
function parseForm(formData: FormData) {
  const scores: { item_id: string; score: number }[] = [];
  const blockNotes: { block_id: string; notes: string }[] = [];
  const dofa: { sport: string; quadrant: string; subarea: string; notes: string }[] = [];
  const goalieDofa: { sport: string; item: string; notes: string }[] = [];

  for (const [key, rawValue] of formData.entries()) {
    const value = String(rawValue);
    if (key.startsWith('score_')) {
      scores.push({ item_id: key.slice('score_'.length), score: Number(value) });
    } else if (key.startsWith('block_notes_')) {
      blockNotes.push({ block_id: key.slice('block_notes_'.length), notes: value });
    } else if (key.startsWith('dofa_portero_')) {
      const rest = key.slice('dofa_portero_'.length);
      const sportPrefix = DOFA_SPORT_PREFIXES.find((p) => rest.startsWith(p));
      if (!sportPrefix) continue;
      const sport = sportPrefix.slice(0, -1);
      const item = rest.slice(sportPrefix.length);
      goalieDofa.push({ sport, item, notes: value });
    } else if (key.startsWith('dofa_')) {
      const rest = key.slice('dofa_'.length);
      const sportPrefix = DOFA_SPORT_PREFIXES.find((p) => rest.startsWith(p));
      if (!sportPrefix) continue;
      const sport = sportPrefix.slice(0, -1);
      const afterSport = rest.slice(sportPrefix.length);
      const idx = afterSport.indexOf('_');
      dofa.push({ sport, quadrant: afterSport.slice(0, idx), subarea: afterSport.slice(idx + 1), notes: value });
    }
  }

  return { scores, blockNotes, dofa, goalieDofa };
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

  const { scores, blockNotes, dofa, goalieDofa } = parseForm(formData);

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

  if (dofa.length > 0) {
    const { error: dofaError } = await supabase
      .from('evaluation_dofa')
      .insert(dofa.map((d) => ({ report_id: report.id, sport: d.sport, quadrant: d.quadrant, subarea: d.subarea, notes: d.notes })));
    if (dofaError) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(dofaError.message)}`);
    }
  }

  if (goalieDofa.length > 0) {
    const { error: goalieDofaError } = await supabase
      .from('evaluation_goalie_dofa')
      .insert(goalieDofa.map((d) => ({ report_id: report.id, sport: d.sport, item: d.item, notes: d.notes })));
    if (goalieDofaError) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(goalieDofaError.message)}`);
    }
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

  const { scores, blockNotes, dofa, goalieDofa } = parseForm(formData);

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
  if (dofa.length > 0) {
    const { error: dofaError } = await supabase
      .from('evaluation_dofa')
      .insert(dofa.map((d) => ({ report_id, sport: d.sport, quadrant: d.quadrant, subarea: d.subarea, notes: d.notes })));
    if (dofaError) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(dofaError.message)}`);
    }
  }

  await supabase.from('evaluation_goalie_dofa').delete().eq('report_id', report_id);
  if (goalieDofa.length > 0) {
    const { error: goalieDofaError } = await supabase
      .from('evaluation_goalie_dofa')
      .insert(goalieDofa.map((d) => ({ report_id, sport: d.sport, item: d.item, notes: d.notes })));
    if (goalieDofaError) {
      redirect(`${BASE_PATH}?error=${encodeURIComponent(goalieDofaError.message)}`);
    }
  }

  revalidatePath(BASE_PATH);
  redirect(`/dashboard/evaluations/${report_id}`);
}
