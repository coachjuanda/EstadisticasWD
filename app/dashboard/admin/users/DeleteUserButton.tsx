'use client';

import { deleteUserAction } from './actions';

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  return (
    <form
      action={deleteUserAction}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar a ${userName}? Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={userId} />
      <button type="submit" className="text-xs text-red-600 hover:underline">
        Eliminar
      </button>
    </form>
  );
}
