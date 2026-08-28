'use client';

import { useMemo, useState } from 'react';
import { addRosterPlayers } from './actions';

type Athlete = { id: string; full_name: string; cedula: string; suggestedJersey: number | null };

export function AddRosterPlayersForm({ rosterId, athletes }: { rosterId: string; athletes: Athlete[] }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [jerseyByAthlete, setJerseyByAthlete] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => a.full_name.toLowerCase().includes(q));
  }, [search, athletes]);

  function toggle(athlete: Athlete) {
    setSelected((prev) => ({ ...prev, [athlete.id]: !prev[athlete.id] }));
    // Pre-llena la sugerencia solo la primera vez que se marca -- si el
    // admin ya editó el número (o lo destildó y volvió a marcar), no se
    // pisa lo que haya puesto.
    setJerseyByAthlete((prev) => {
      if (prev[athlete.id] !== undefined) return prev;
      return { ...prev, [athlete.id]: athlete.suggestedJersey != null ? String(athlete.suggestedJersey) : '' };
    });
  }

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const payload = selectedIds.map((id) => {
    const raw = jerseyByAthlete[id];
    return { athlete_id: id, jersey_number: raw !== undefined && raw !== '' ? Number(raw) : null };
  });

  return (
    <form action={addRosterPlayers} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="roster_id" value={rosterId} />
      <input type="hidden" name="players_json" value={JSON.stringify(payload)} />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor="athlete-search">
          Buscar deportista
        </label>
        <input
          id="athlete-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nombre..."
          className="w-full max-w-xs rounded-lg border border-neutral-300 px-2 py-1 text-sm"
        />
      </div>

      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-xl border border-neutral-200 p-2">
        {filtered.map((a) => {
          const isChecked = !!selected[a.id];
          return (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-white px-3 py-2.5"
            >
              <label className="flex flex-1 items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(a)}
                  className="h-5 w-5 shrink-0"
                />
                <span>
                  {a.full_name} <span className="text-xs text-neutral-400">({a.cedula})</span>
                </span>
              </label>
              <input
                type="number"
                min={0}
                disabled={!isChecked}
                value={jerseyByAthlete[a.id] ?? ''}
                onChange={(e) => setJerseyByAthlete((prev) => ({ ...prev, [a.id]: e.target.value }))}
                placeholder="#"
                className="w-20 shrink-0 rounded-lg border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
              />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-neutral-500">
            {athletes.length === 0 ? 'Todos los deportistas del club ya están en esta nómina.' : 'Sin resultados.'}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={selectedIds.length === 0}
        className="w-fit rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
      >
        Agregar {selectedIds.length > 0 ? `${selectedIds.length} ` : ''}deportista{selectedIds.length === 1 ? '' : 's'}
      </button>
    </form>
  );
}
