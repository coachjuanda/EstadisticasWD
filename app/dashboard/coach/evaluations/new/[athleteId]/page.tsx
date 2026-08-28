import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createEvaluation } from '../../actions';
import { EvaluationForm } from '../../EvaluationForm';

type BlockRow = { id: string; key: string; label: string; sort_order: number; applies_to: string };
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
    supabase.from('athlete_profiles').select('full_name, position').eq('id', athleteId).single(),
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
  ]);

  // Deportistas sin posición asignada siguen viendo el catálogo de jugador
  // de campo (comportamiento previo a este cambio).
  const position = (athlete as { position?: string } | null)?.position ?? 'jugador_de_campo';
  const isGoalie = position === 'portero';

  const blocks = (blocksData ?? [])
    .filter((b) => b.applies_to === 'ambos' || b.applies_to === position)
    .map((b) => ({
      ...b,
      items: (itemsData ?? []).filter((i) => i.block_id === b.id),
    }));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <EvaluationForm
        action={createEvaluation}
        athleteName={athlete?.full_name ?? '—'}
        blocks={blocks}
        isGoalie={isGoalie}
        hiddenFields={{ athlete_id: athleteId, division_id: division_id ?? '' }}
        submitLabel="Guardar evaluación"
      />
      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
