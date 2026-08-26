import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createEvaluation } from '../../actions';
import { EvaluationForm } from '../../EvaluationForm';

type BlockRow = { id: string; key: string; label: string; sort_order: number };
type ItemRow = { id: string; block_id: string; key: string; label: string; sort_order: number };

export default async function NewEvaluationPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ division_id?: string }>;
}) {
  const { athleteId } = await params;
  const { division_id } = await searchParams;
  const supabase = await createClient();

  const [{ data: athlete }, { data: blocksData }, { data: itemsData }] = await Promise.all([
    supabase.from('athlete_profiles').select('full_name').eq('id', athleteId).single(),
    supabase.from('evaluation_blocks').select('id, key, label, sort_order').order('sort_order').returns<BlockRow[]>(),
    supabase
      .from('evaluation_items')
      .select('id, block_id, key, label, sort_order')
      .order('sort_order')
      .returns<ItemRow[]>(),
  ]);

  const blocks = (blocksData ?? []).map((b) => ({
    ...b,
    items: (itemsData ?? []).filter((i) => i.block_id === b.id),
  }));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <EvaluationForm
        action={createEvaluation}
        athleteName={athlete?.full_name ?? '—'}
        blocks={blocks}
        hiddenFields={{ athlete_id: athleteId, division_id: division_id ?? '' }}
        submitLabel="Guardar evaluación"
      />
      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
