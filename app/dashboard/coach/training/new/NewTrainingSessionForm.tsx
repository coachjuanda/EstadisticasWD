'use client';

import { useActionState, useMemo, useState } from 'react';
import { createTrainingSessionAction, type CreateTrainingSessionState } from '../actions';

type Athlete = { id: string; full_name: string };
type Division = { id: string; name: string; athletes: Athlete[] };
type Coach = { id: string; full_name: string };

const initialState: CreateTrainingSessionState = { status: 'idle' };

export function NewTrainingSessionForm({ divisions, coaches }: { divisions: Division[]; coaches: Coach[] }) {
  const [state, formAction, pending] = useActionState(createTrainingSessionAction, initialState);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<string[]>([]);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({});
  const [presentCoachIds, setPresentCoachIds] = useState<string[]>([]);

  const convocados = useMemo(() => {
    const seen = new Map<string, Athlete>();
    for (const divisionId of selectedDivisionIds) {
      const division = divisions.find((d) => d.id === divisionId);
      for (const athlete of division?.athletes ?? []) {
        seen.set(athlete.id, athlete);
      }
    }
    return [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [selectedDivisionIds, divisions]);

  function toggleDivision(divisionId: string) {
    setSelectedDivisionIds((prev) =>
      prev.includes(divisionId) ? prev.filter((id) => id !== divisionId) : [...prev, divisionId]
    );
  }

  function markAllPresent() {
    setPresentMap((prev) => {
      const next = { ...prev };
      for (const athlete of convocados) next[athlete.id] = true;
      return next;
    });
  }

  function toggleAthlete(athleteId: string) {
    setPresentMap((prev) => ({ ...prev, [athleteId]: !prev[athleteId] }));
  }

  function toggleCoach(coachId: string) {
    setPresentCoachIds((prev) =>
      prev.includes(coachId) ? prev.filter((id) => id !== coachId) : [...prev, coachId]
    );
  }

  const attendancePayload = convocados.map((a) => ({ athlete_id: a.id, present: !!presentMap[a.id] }));
  const presentCount = attendancePayload.filter((a) => a.present).length;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="division_ids" value={JSON.stringify(selectedDivisionIds)} />
      <input type="hidden" name="attendance" value={JSON.stringify(attendancePayload)} />
      <input type="hidden" name="coach_ids" value={JSON.stringify(presentCoachIds)} />

      <h1 className="text-xl font-semibold text-neutral-900">Nueva sesión de entrenamiento</h1>

      {state.status === 'error' && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="scheduled_date" className="text-sm font-medium text-neutral-700">
              Fecha
            </label>
            <input
              id="scheduled_date"
              name="scheduled_date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="scheduled_time" className="text-sm font-medium text-neutral-700">
              Hora
            </label>
            <input
              id="scheduled_time"
              name="scheduled_time"
              type="time"
              required
              defaultValue="18:00"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor="location" className="text-sm font-medium text-neutral-700">
            Cancha / lugar (opcional)
          </label>
          <input
            id="location"
            name="location"
            type="text"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Divisiones convocadas</h2>
        <div className="mt-3 flex flex-col gap-2">
          {divisions.map((d) => (
            <label
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
            >
              <span className="text-neutral-800">{d.name}</span>
              <input
                type="checkbox"
                checked={selectedDivisionIds.includes(d.id)}
                onChange={() => toggleDivision(d.id)}
                className="h-5 w-5"
              />
            </label>
          ))}
          {divisions.length === 0 && (
            <p className="text-sm text-neutral-500">No hay divisiones con deportistas asociados.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Entrenadores presentes</h2>
        <div className="mt-3 flex flex-col gap-2">
          {coaches.map((c) => (
            <label
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
            >
              <span className="text-neutral-800">{c.full_name}</span>
              <input
                type="checkbox"
                checked={presentCoachIds.includes(c.id)}
                onChange={() => toggleCoach(c.id)}
                className="h-5 w-5"
              />
            </label>
          ))}
          {coaches.length === 0 && (
            <p className="text-sm text-neutral-500">No hay entrenadores activos en el club.</p>
          )}
        </div>
      </section>

      {convocados.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-700">
              Convocatoria ({presentCount}/{convocados.length} presentes)
            </h2>
            <button
              type="button"
              onClick={markAllPresent}
              className="shrink-0 rounded-lg border border-brand-blue px-2.5 py-1 text-xs font-semibold text-brand-blue hover:bg-blue-50"
            >
              Marcar todos presentes
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {convocados.map((a) => (
              <label
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
              >
                <span className="text-neutral-800">{a.full_name}</span>
                <input
                  type="checkbox"
                  checked={!!presentMap[a.id]}
                  onChange={() => toggleAthlete(a.id)}
                  className="h-5 w-5"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      <button
        type="submit"
        disabled={pending || convocados.length === 0}
        className="w-fit rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
      >
        {pending ? 'Guardando...' : 'Guardar sesión'}
      </button>
    </form>
  );
}
