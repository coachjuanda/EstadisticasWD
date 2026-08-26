import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type BlockRow = { id: string; key: string; label: string; sort_order: number };
type ItemRow = { id: string; block_id: string; key: string; label: string; sort_order: number };

const QUADRANT_LABELS: Record<string, string> = {
  fortalezas: 'Fortalezas',
  oportunidades: 'Oportunidades',
  debilidades: 'Debilidades',
  amenazas: 'Amenazas',
};

const SUBAREA_LABELS: Record<string, string> = {
  defensivo: 'Defensivo',
  ofensivo: 'Ofensivo',
  general: 'General',
  trabajo_equipo: 'Trabajo en equipo',
  comunicacion: 'Comunicación',
  autoconfianza: 'Autoconfianza',
};

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: report } = await supabase
    .from('evaluation_reports')
    .select('id, report_date, coach_id, athlete_profiles(full_name), divisions(name)')
    .eq('id', reportId)
    .maybeSingle<{
      id: string;
      report_date: string;
      coach_id: string;
      athlete_profiles: { full_name: string } | null;
      divisions: { name: string } | null;
    }>();

  // RLS ya filtra: si no eres admin, el coach dueño, o el deportista dueño,
  // report viene null.
  if (!report) {
    redirect('/dashboard?error=unauthorized');
  }

  // profiles.coach_id no se puede embeber directo: profiles solo se puede
  // leer completo si eres tú mismo o admin. coach_names es la vista reducida
  // (solo id + nombre) que cualquier miembro del club sí puede consultar.
  const { data: coach } = await supabase
    .from('coach_names')
    .select('full_name')
    .eq('id', report.coach_id)
    .maybeSingle();

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

  const scoreByItem = new Map((scoresData ?? []).map((s) => [s.item_id, s.score as number]));
  const notesByBlock = new Map((notesData ?? []).map((n) => [n.block_id, n.notes]));
  const dofaByKey = new Map((dofaData ?? []).map((d) => [`${d.quadrant}_${d.subarea}`, d.notes]));

  const blocks = (blocksData ?? []).map((b) => {
    const items = (itemsData ?? []).filter((i) => i.block_id === b.id);
    const scores = items.map((i) => scoreByItem.get(i.id)).filter((s): s is number => s !== undefined);
    const average = scores.length > 0 ? scores.reduce((a, b2) => a + b2, 0) / scores.length : null;
    return { ...b, items, average, notes: notesByBlock.get(b.id) ?? '' };
  });

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">
        Evaluación técnica — {report.athlete_profiles?.full_name ?? '—'}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {new Date(report.report_date).toLocaleDateString('es-CO', { dateStyle: 'long' })}
        {' · '}
        {report.divisions?.name ?? '—'}
        {' · '}
        Evaluado por {coach?.full_name ?? '—'}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {blocks.map((b) => (
          <section
            key={b.id}
            className="rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-neutral-700">{b.label}</h2>
              <span className="text-sm font-bold tabular-nums text-neutral-900">
                Promedio: {b.average !== null ? b.average.toFixed(1) : '—'}
              </span>
            </div>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {b.items.map((i) => (
                  <tr key={i.id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-1 text-neutral-700">{i.label}</td>
                    <td className="py-1 text-right font-semibold tabular-nums text-neutral-900">
                      {scoreByItem.get(i.id) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {b.notes && (
              <p className="mt-2 text-sm text-neutral-600">
                <span className="font-medium">Observaciones: </span>
                {b.notes}
              </p>
            )}
          </section>
        ))}
      </div>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">DOFA</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(QUADRANT_LABELS).map(([qKey, qLabel]) => (
            <div key={qKey}>
              <p className="text-sm font-medium text-neutral-800">{qLabel}</p>
              <dl className="mt-1 flex flex-col gap-1">
                {Object.entries(SUBAREA_LABELS).map(([sKey, sLabel]) => {
                  const text = dofaByKey.get(`${qKey}_${sKey}`);
                  if (!text) return null;
                  return (
                    <div key={sKey} className="text-sm">
                      <dt className="font-medium text-neutral-600">{sLabel}</dt>
                      <dd className="text-neutral-700">{text}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}
