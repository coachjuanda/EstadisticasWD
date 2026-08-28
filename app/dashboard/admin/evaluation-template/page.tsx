import { createClient } from '@/lib/supabase/server';
import {
  createBlock,
  createItem,
  moveBlock,
  moveItem,
  toggleBlockActive,
  toggleItemActive,
  updateBlock,
  updateItem,
} from './actions';

type BlockRow = {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  applies_to: string;
  is_active: boolean;
};
type ItemRow = {
  id: string;
  block_id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

const APPLIES_TO_OPTIONS: { value: string; label: string }[] = [
  { value: 'jugador_de_campo', label: 'Jugador de campo' },
  { value: 'portero', label: 'Portero' },
  { value: 'ambos', label: 'Ambos' },
];

const APPLIES_TO_LABELS: Record<string, string> = Object.fromEntries(
  APPLIES_TO_OPTIONS.map((o) => [o.value, o.label])
);

export default async function EvaluationTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: blocksData }, { data: itemsData }] = await Promise.all([
    supabase
      .from('evaluation_blocks')
      .select('id, key, label, sort_order, applies_to, is_active')
      .order('sort_order')
      .returns<BlockRow[]>(),
    supabase
      .from('evaluation_items')
      .select('id, block_id, key, label, sort_order, is_active')
      .order('sort_order')
      .returns<ItemRow[]>(),
  ]);

  const blocks = (blocksData ?? []).map((b, idx, arr) => ({
    ...b,
    items: (itemsData ?? []).filter((i) => i.block_id === b.id),
    isFirst: idx === 0,
    isLast: idx === arr.length - 1,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-neutral-900">Plantilla de evaluaciones</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Bloques e ítems que ven los coaches al evaluar. &quot;Aplica a&quot; controla si el bloque
        aparece para jugador de campo, portero o ambos, según la posición del deportista.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {blocks.map((block) => (
          <section
            key={block.id}
            className={`rounded-xl border p-4 ${
              block.is_active ? 'border-neutral-200 bg-white' : 'border-neutral-200 bg-neutral-50 opacity-70'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-neutral-800">
                  {block.label}
                  {!block.is_active && (
                    <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-normal text-neutral-600">
                      Inactivo
                    </span>
                  )}
                </h2>
                <p className="text-xs text-neutral-500">
                  Aplica a: {APPLIES_TO_LABELS[block.applies_to] ?? block.applies_to}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <form action={moveBlock}>
                  <input type="hidden" name="id" value={block.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={block.isFirst}
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                </form>
                <form action={moveBlock}>
                  <input type="hidden" name="id" value={block.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={block.isLast}
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </form>
                <form action={toggleBlockActive}>
                  <input type="hidden" name="id" value={block.id} />
                  <input type="hidden" name="next" value={(!block.is_active).toString()} />
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
                  >
                    {block.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </form>
              </div>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-brand-blue hover:underline">
                Editar bloque
              </summary>
              <form action={updateBlock} className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={block.id} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Nombre</label>
                  <input
                    name="label"
                    defaultValue={block.label}
                    required
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Aplica a</label>
                  <select
                    name="applies_to"
                    defaultValue={block.applies_to}
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                  >
                    {APPLIES_TO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
                >
                  Guardar
                </button>
              </form>
            </details>

            <div className="mt-3 flex flex-col gap-1 border-t border-neutral-100 pt-3">
              {block.items.map((item, idx, arr) => (
                <div
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 ${
                    item.is_active ? '' : 'opacity-50'
                  }`}
                >
                  <span className="text-sm text-neutral-700">
                    {item.label}
                    {!item.is_active && <span className="ml-2 text-xs text-neutral-400">(inactivo)</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    <form action={moveItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="block_id" value={block.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={idx === 0}
                        className="rounded-lg border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100 disabled:opacity-30"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="block_id" value={block.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={idx === arr.length - 1}
                        className="rounded-lg border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100 disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </form>
                    <details className="inline-block">
                      <summary className="cursor-pointer list-none rounded-lg border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100">
                        Editar
                      </summary>
                      <form action={updateItem} className="mt-2 flex items-end gap-2">
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          name="label"
                          defaultValue={item.label}
                          required
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand-blue px-2 py-1 text-xs font-semibold text-white hover:bg-brand-blue-hover"
                        >
                          Guardar
                        </button>
                      </form>
                    </details>
                    <form action={toggleItemActive}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="next" value={(!item.is_active).toString()} />
                      <button
                        type="submit"
                        className="rounded-lg border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100"
                      >
                        {item.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
              {block.items.length === 0 && (
                <p className="text-sm text-neutral-500">Todavía no hay ítems.</p>
              )}
            </div>

            <form action={createItem} className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
              <input type="hidden" name="block_id" value={block.id} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Nuevo ítem</label>
                <input
                  name="label"
                  required
                  placeholder="Nombre del ítem"
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
              >
                Agregar ítem
              </button>
            </form>
          </section>
        ))}
        {blocks.length === 0 && <p className="text-sm text-neutral-500">Todavía no hay bloques.</p>}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">Agregar bloque</h2>
      <form action={createBlock} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="new-block-label">
            Nombre
          </label>
          <input
            id="new-block-label"
            name="label"
            required
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="new-block-applies-to">
            Aplica a
          </label>
          <select
            id="new-block-applies-to"
            name="applies_to"
            defaultValue="ambos"
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          >
            {APPLIES_TO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Agregar bloque
        </button>
      </form>
    </div>
  );
}
