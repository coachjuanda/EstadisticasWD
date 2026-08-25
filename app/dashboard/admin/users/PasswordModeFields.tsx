'use client';

import { useState } from 'react';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';

export function PasswordModeFields({ idPrefix }: { idPrefix: string }) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-neutral-500">Contraseña</p>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="password_mode"
            value="auto"
            checked={mode === 'auto'}
            onChange={() => setMode('auto')}
          />
          Generar automáticamente
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="password_mode"
            value="manual"
            checked={mode === 'manual'}
            onChange={() => setMode('manual')}
          />
          Asignar manualmente
        </label>
      </div>

      {mode === 'manual' && (
        <div className="mt-1 flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor={`${idPrefix}-password`}>
              Nueva contraseña
            </label>
            <input
              id={`${idPrefix}-password`}
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor={`${idPrefix}-password-confirm`}>
              Confirmar contraseña
            </label>
            <input
              id={`${idPrefix}-password-confirm`}
              name="password_confirm"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <p className="w-full text-xs text-neutral-400">
            Mínimo {MIN_PASSWORD_LENGTH} caracteres, con al menos una letra y un número.
          </p>
        </div>
      )}
    </div>
  );
}
