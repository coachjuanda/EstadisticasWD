'use client';

import { useActionState, useState } from 'react';
import { resetPasswordAction, type ResetPasswordState } from './actions';
import { PasswordModeFields } from './PasswordModeFields';

const initialState: ResetPasswordState = { status: 'idle' };

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (state.status === 'success' && !dismissed) {
    return (
      <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-2">
        {state.passwordMode === 'auto' ? (
          <>
            <p className="text-xs text-amber-800">Contraseña nueva — cópiala ahora, no se puede volver a ver:</p>
            <code className="mt-1 block select-all rounded bg-white px-2 py-1 font-mono text-xs text-neutral-900">
              {state.password}
            </code>
          </>
        ) : (
          <p className="text-xs text-amber-800">Se guardó la contraseña que asignaste.</p>
        )}
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            setOpen(false);
          }}
          className="mt-1 text-xs text-amber-700 hover:underline"
        >
          Listo
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-500 hover:underline">
        Resetear contraseña
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex w-64 flex-col gap-2 rounded-lg border border-neutral-300 bg-white p-2">
      <input type="hidden" name="user_id" value={userId} />
      {state.status === 'error' && <p className="text-xs text-red-600">{state.message}</p>}
      <PasswordModeFields idPrefix={`reset-${userId}`} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-brand-blue px-2 py-1 text-xs font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
        >
          {pending ? 'Reseteando...' : 'Resetear'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
