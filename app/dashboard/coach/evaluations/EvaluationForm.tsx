type Item = { id: string; key: string; label: string; sort_order: number };
type Block = { id: string; key: string; label: string; sort_order: number; items: Item[] };

const SCALE_LABELS: Record<number, string> = {
  1: '1 · No lo ha aprendido',
  2: '2 · En proceso de aprendizaje',
  3: '3 · Aprendido',
  4: '4 · Lo controla conscientemente',
  5: '5 · Lo maneja al 100%',
};

const QUADRANTS: { key: string; label: string }[] = [
  { key: 'fortalezas', label: 'Fortalezas' },
  { key: 'oportunidades', label: 'Oportunidades' },
  { key: 'debilidades', label: 'Debilidades' },
  { key: 'amenazas', label: 'Amenazas' },
];

const SUBAREAS: { key: string; label: string }[] = [
  { key: 'defensivo', label: 'Defensivo' },
  { key: 'ofensivo', label: 'Ofensivo' },
  { key: 'general', label: 'General' },
  { key: 'trabajo_equipo', label: 'Trabajo en equipo' },
  { key: 'comunicacion', label: 'Comunicación' },
  { key: 'autoconfianza', label: 'Autoconfianza' },
];

// Dos DOFA completos y siempre visibles -- el coach decide cuál(es) llenar
// según a qué deporte(s) juegue el deportista, sin importar la posición o
// el deporte real del torneo.
const DOFA_SPORTS: { key: string; label: string }[] = [
  { key: 'hockey_linea', label: 'DOFA — Hockey en línea' },
  { key: 'hockey_hielo', label: 'DOFA — Hockey en hielo' },
];

// DOFA de portero: 4 ítems de texto libre en vez de la estructura de
// cuadrante × sub-área del jugador de campo.
const GOALIE_DOFA_ITEMS: { key: string; label: string }[] = [
  { key: 'oportunidades_mejora', label: 'Oportunidades de mejora' },
  { key: 'fortalezas', label: 'Fortalezas' },
  { key: 'aprendizajes', label: 'Aprendizajes' },
  { key: 'metas', label: 'Metas' },
];

export function EvaluationForm({
  action,
  athleteName,
  blocks,
  isGoalie,
  hiddenFields,
  existingScores,
  existingBlockNotes,
  existingDofa,
  existingGoalieDofa,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  athleteName: string;
  blocks: Block[];
  isGoalie: boolean;
  hiddenFields: Record<string, string>;
  existingScores?: Record<string, number>;
  existingBlockNotes?: Record<string, string>;
  existingDofa?: Record<string, string>;
  existingGoalieDofa?: Record<string, string>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-6">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <h1 className="text-xl font-semibold text-neutral-900">
        Evaluación técnica — {athleteName}
      </h1>

      {blocks.map((block) => (
        <section
          key={block.id}
          className="rounded-xl border border-neutral-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-neutral-700">{block.label}</h2>
          <div className="mt-3 flex flex-col gap-3">
            {block.items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor={`score_${item.id}`}
                  className="text-sm text-neutral-700"
                >
                  {item.label}
                </label>
                <select
                  id={`score_${item.id}`}
                  name={`score_${item.id}`}
                  required
                  defaultValue={existingScores?.[item.id] ?? ''}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                >
                  <option value="" disabled>
                    Elige...
                  </option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {SCALE_LABELS[n]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <label
              htmlFor={`block_notes_${block.id}`}
              className="text-xs text-neutral-500"
            >
              Observaciones del bloque
            </label>
            <textarea
              id={`block_notes_${block.id}`}
              name={`block_notes_${block.id}`}
              rows={2}
              defaultValue={existingBlockNotes?.[block.id] ?? ''}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
        </section>
      ))}

      {isGoalie
        ? DOFA_SPORTS.map((sport) => (
            <section key={sport.key} className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-neutral-700">{sport.label}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {GOALIE_DOFA_ITEMS.map((item) => {
                  const name = `dofa_portero_${sport.key}_${item.key}`;
                  return (
                    <div key={item.key} className="flex flex-col gap-1">
                      <label htmlFor={name} className="text-sm font-medium text-neutral-800">
                        {item.label}
                      </label>
                      <textarea
                        id={name}
                        name={name}
                        rows={2}
                        defaultValue={existingGoalieDofa?.[`${sport.key}_${item.key}`] ?? ''}
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        : DOFA_SPORTS.map((sport) => (
            <section key={sport.key} className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-neutral-700">{sport.label}</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {QUADRANTS.map((q) => (
                  <div key={q.key}>
                    <p className="text-sm font-medium text-neutral-800">{q.label}</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {SUBAREAS.map((s) => {
                        const name = `dofa_${sport.key}_${q.key}_${s.key}`;
                        return (
                          <div key={s.key} className="flex flex-col gap-1">
                            <label htmlFor={name} className="text-xs text-neutral-500">
                              {s.label}
                            </label>
                            <textarea
                              id={name}
                              name={name}
                              rows={2}
                              defaultValue={existingDofa?.[`${sport.key}_${q.key}_${s.key}`] ?? ''}
                              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

      <button
        type="submit"
        className="w-fit rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover"
      >
        {submitLabel}
      </button>
    </form>
  );
}
