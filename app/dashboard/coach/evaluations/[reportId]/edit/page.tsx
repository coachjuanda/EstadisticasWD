import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updateEvaluation } from '../../actions';
import { EvaluationForm } from '../../EvaluationForm';

type BlockRow = { id: string; key: string; label: string; sort_order: number };
type ItemRow = { id: string; block_id: string; key: string; label: string; sort_order: number };

export default async function EditEvaluationPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const supabase = await createClient();

  const { data: report } = await supabase
    .from('evaluation_reports')
    .select('id, athlete_id, athlete_profiles(full_name)')
    .eq('id', reportId)
    .maybeSingle<{ id: string; athlete_id: string; athlete_profiles: { full_name: string } | null }>();

  // Si el report no es de este coach, RLS ya lo filtró y report viene null
  // -- "ni siquiera otro coach" puede llegar a editarlo.
  if (!report) {
    redirect(
      `/dashboard/coach/evaluations?error=${encodeURIComponent('Evaluación no encontrada o no te pertenece.')}`
    );
  }

  const [{ data: blocksData }, { data: itemsData }, { data: scoresData }, { data: notesData }, { data: dofaData }] =
    await Promise.all([
      supabase.from('evaluation_blocks').select('id, key, label, sort_order').order('sort_order').returns<BlockRow[]>(),
      supabase
        .from('evaluation_items')
        .select('id, block_id, key, label, sort_order')
        .order('sort_order')
        .returns<ItemRow[]>(),
      supabase.from('evaluation_scores').select('item_id, score').eq('report_id', reportId),
      supabase.from('evaluation_block_notes').select('block_id, notes').eq('report_id', reportId),
      supabase.from('evaluation_dofa').select('quadrant, subarea, notes').eq('report_id', reportId),
    ]);

  const blocks = (blocksData ?? []).map((b) => ({
    ...b,
    items: (itemsData ?? []).filter((i) => i.block_id === b.id),
  }));

  const existingScores = Object.fromEntries((scoresData ?? []).map((s) => [s.item_id, s.score]));
  const existingBlockNotes = Object.fromEntries((notesData ?? []).map((n) => [n.block_id, n.notes ?? '']));
  const existingDofa = Object.fromEntries(
    (dofaData ?? []).map((d) => [`${d.quadrant}_${d.subarea}`, d.notes ?? ''])
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <EvaluationForm
        action={updateEvaluation}
        athleteName={report.athlete_profiles?.full_name ?? '—'}
        blocks={blocks}
        hiddenFields={{ report_id: reportId }}
        existingScores={existingScores}
        existingBlockNotes={existingBlockNotes}
        existingDofa={existingDofa}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
