'use client';

import { useActionState, useState } from 'react';
import { updateTrainingAttendanceAction, type UpdateAttendanceState } from '../actions';

type Athlete = { id: string; full_name: string; present: boolean };
type Coach = { id: string; full_name: string; present: boolean };

const initialState: UpdateAttendanceState = { status: 'idle' };

export function EditAttendanceForm({
  sessionId,
  athletes,
  coaches,
}: {
  sessionId: string;
  athletes: Athlete[];
  coaches: Coach[];
}) {
  const [state, formAction, pending] = useActionState(updateTrainingAttendanceAction, initialState);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(athletes.map((a) => [a.id, a.present]))
  );
  const [presentCoachMap, setPresentCoachMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(coaches.map((c) => [c.id, c.present]))
  );

  function toggle(id: string) {
    setPresentMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleCoach(id: string) {
    setPresentCoachMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function markAllPresent() {
    setPresentMap((prev) => {
      const next = { ...prev };
      for (const a of athletes) next[a.id] = true;
      return next;
    });
  }

  const attendancePayload = athletes.map((a) => ({ id: a.id, present: !!presentMap[a.id] }));
  const presentCount = attendancePayload.filter((a) => a.present).length;
  const presentCoachIds = coaches.filter((c) => !!presentCoachMap[c.id]).map((c) => c.id);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="attendance" value={JSON.stringify(attendancePayload)} />
      <input type="hidden" name="coach_ids" value={JSON.stringify(presentCoachIds)} />

      {state.status === 'error' && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">Entrenadores presentes</h2>
        {coaches.map((c) => (
          <label
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm"
          >
            <span className="text-neutral-800">{c.full_name}</span>
            <input
              type="checkbox"
              checked={!!presentCoachMap[c.id]}
              onChange={() => toggleCoach(c.id)}
              className="h-5 w-5"
            />
          </label>
        ))}
        {coaches.length === 0 && (
          <p className="text-sm text-neutral-500">No hay entrenadores activos en el club.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">
          Asistencia ({presentCount}/{athletes.length} presentes)
        </h2>
        <button
          type="button"
          onClick={markAllPresent}
          className="shrink-0 rounded-lg border border-brand-blue px-2.5 py-1 text-xs font-semibold text-brand-blue hover:bg-blue-50"
        >
          Marcar todos presentes
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {athletes.map((a) => (
          <label
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm"
          >
            <span className="text-neutral-800">{a.full_name}</span>
            <input
              type="checkbox"
              checked={!!presentMap[a.id]}
              onChange={() => toggle(a.id)}
              className="h-5 w-5"
            />
          </label>
        ))}
        {athletes.length === 0 && (
          <p className="text-sm text-neutral-500">No hay deportistas convocados en esta sesión.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
      >
        {pending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  );
}
