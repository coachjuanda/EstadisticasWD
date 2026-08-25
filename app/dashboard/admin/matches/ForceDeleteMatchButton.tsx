'use client';

import { useState } from 'react';
import { forceDeleteMatch } from './actions';

export function ForceDeleteMatchButton({ matchId, awayTeamName }: { matchId: string; awayTeamName: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-700 hover:underline"
      >
        Forzar borrado (admin)
      </button>
    );
  }

  return (
    <form
      action={forceDeleteMatch}
      className="mt-2 flex w-56 flex-col gap-1.5 rounded-lg border border-red-300 bg-red-50 p-2"
    >
      <input type="hidden" name="id" value={matchId} />
      <p className="text-xs text-red-700">
        Esto borra el partido y <strong>todas</strong> sus estadísticas para siempre. No se puede deshacer.
        Escribe exactamente <strong>{awayTeamName}</strong> para confirmar:
      </p>
      <input
        name="confirmation"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        className="rounded border border-neutral-300 px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={text !== awayTeamName}
          className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
        >
          Borrar para siempre
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText('');
          }}
          className="text-xs text-neutral-500 hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
