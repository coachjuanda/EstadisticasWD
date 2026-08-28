import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updateEvaluation } from '../../actions';
import { EvaluationForm } from '../../EvaluationForm';

type BlockRow = { id: string; key: string; label: string; sort_order: number; applies_to: string };
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
    .select('id, athlete_id, athlete_profiles(full_name, position)')
    .eq('id', reportId)
    .maybeSingle<{
      id: string;
      athlete_id: string;
      athlete_profiles: { full_name: string; position: string | null } | null;
    }>();

  // Si el report no es de este coach, RLS ya lo filtró y report viene null
  // -- "ni siquiera otro coach" puede llegar a editarlo.
  if (!report) {
    redirect(
      `/dashboard/coach/evaluations?error=${encodeURIComponent('Evaluación no encontrada o no te pertenece.')}`
    );
  }

  const position = report.athlete_profiles?.position ?? 'jugador_de_campo';
  const isGoalie = position === 'portero';

  const [{ data: blocksData }, { data: itemsData }, { data: scoresData }, { data: notesData }, { data: dofaData }, { data: goalieDofaData }] =
    await Promise.all([
      supabase
        .from('evaluation_blocks')
        .select('id, key, label, sort_order, applies_to')
        .eq('is_active', true)
        .order('sort_order')
        .returns<BlockRow[]>(),
      supabase
        .from('evaluation_items')
        .select('id, block_id, key, label, sort_order')
        .eq('is_active', true)
        .order('sort_order')
        .returns<ItemRow[]>(),
      supabase.from('evaluation_scores').select('item_id, score').eq('report_id', reportId),
      supabase.from('evaluation_block_notes').select('block_id, notes').eq('report_id', reportId),
      supabase.from('evaluation_dofa').select('sport, quadrant, subarea, notes').eq('report_id', reportId),
      supabase.from('evaluation_goalie_dofa').select('sport, item, notes').eq('report_id', reportId),
    ]);

  const blocks = (blocksData ?? [])
    .filter((b) => b.applies_to === 'ambos' || b.applies_to === position)
    .map((b) => ({
      ...b,
      items: (itemsData ?? []).filter((i) => i.block_id === b.id),
    }));

  const existingScores = Object.fromEntries((scoresData ?? []).map((s) => [s.item_id, s.score]));
  const existingBlockNotes = Object.fromEntries((notesData ?? []).map((n) => [n.block_id, n.notes ?? '']));
  const existingDofa = Object.fromEntries(
    (dofaData ?? []).map((d) => [`${d.sport}_${d.quadrant}_${d.subarea}`, d.notes ?? ''])
  );
  const existingGoalieDofa = Object.fromEntries(
    (goalieDofaData ?? []).map((d) => [`${d.sport}_${d.item}`, d.notes ?? ''])
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <EvaluationForm
        action={updateEvaluation}
        athleteName={report.athlete_profiles?.full_name ?? '—'}
        blocks={blocks}
        isGoalie={isGoalie}
        hiddenFields={{ report_id: reportId }}
        existingScores={existingScores}
        existingBlockNotes={existingBlockNotes}
        existingDofa={existingDofa}
        existingGoalieDofa={existingGoalieDofa}
        submitLabel="Guardar cambios"
      />
      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
