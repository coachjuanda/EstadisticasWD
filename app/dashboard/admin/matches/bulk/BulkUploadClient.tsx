'use client';

import { useActionState } from 'react';
import { previewBulkMatchesAction, commitBulkMatchesAction, type PreviewState, type CommitState } from './actions';
import type { BulkMatchRowValidated } from './validation';

const previewInitialState: PreviewState = { status: 'idle' };
const commitInitialState: CommitState = { status: 'idle' };

function UploadStep() {
  const [state, formAction, pending] = useActionState(previewBulkMatchesAction, previewInitialState);

  if (state.status === 'preview') {
    return <PreviewStep rows={state.rows} />;
  }

  return (
    <form action={formAction} className="rounded-xl border border-neutral-200 bg-white p-4">
      {state.status === 'error' && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor="csv">
          Archivo CSV
        </label>
        <input id="csv" name="csv" type="file" accept=".csv,text/csv" required className="text-sm" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
      >
        {pending ? 'Leyendo archivo...' : 'Ver vista previa'}
      </button>
    </form>
  );
}

function PreviewStep({ rows }: { rows: BulkMatchRowValidated[] }) {
  const [state, formAction, pending] = useActionState(commitBulkMatchesAction, commitInitialState);
  const validRows = rows.filter((r) => r.valid);
  const invalidCount = rows.length - validRows.length;

  if (state.status === 'done') {
    return <ResultStep result={state} />;
  }

  return (
    <div>
      <p className="text-sm text-neutral-700">
        {rows.length} fila{rows.length === 1 ? '' : 's'} leída{rows.length === 1 ? '' : 's'} — {validRows.length} lista
        {validRows.length === 1 ? '' : 's'} para crear
        {invalidCount > 0 && `, ${invalidCount} con error${invalidCount === 1 ? '' : 'es'}`}.
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Torneo</th>
              <th className="px-3 py-2 font-medium">Equipo local</th>
              <th className="px-3 py-2 font-medium">Rival</th>
              <th className="px-3 py-2 font-medium">Fecha y hora</th>
              <th className="px-3 py-2 font-medium">Cancha</th>
              <th className="px-3 py-2 font-medium">Scorekeeper</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.index} className={r.valid ? 'border-b border-neutral-100' : 'border-b border-neutral-100 bg-red-50'}>
                <td className="px-3 py-2 text-neutral-500">{r.index + 1}</td>
                <td className="px-3 py-2 text-neutral-900">{r.torneo || '—'}</td>
                <td className="px-3 py-2 text-neutral-700">{r.equipo_local || '—'}</td>
                <td className="px-3 py-2 text-neutral-700">{r.rival || '—'}</td>
                <td className="px-3 py-2 text-neutral-700">{r.fecha_hora || '—'}</td>
                <td className="px-3 py-2 text-neutral-700">{r.cancha_ubicacion || '—'}</td>
                <td className="px-3 py-2 text-neutral-700">{r.scorekeeper || '—'}</td>
                <td className="px-3 py-2">
                  {r.valid ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Lista</span>
                  ) : (
                    <span className="text-xs text-red-700">{r.errors.join(' ')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.status === 'error' && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      )}

      <form action={formAction} className="mt-4 flex items-center gap-3">
        <input type="hidden" name="rows_json" value={JSON.stringify(validRows)} />
        <button
          type="submit"
          disabled={pending || validRows.length === 0}
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50"
        >
          {pending ? 'Creando...' : `Confirmar y crear ${validRows.length} partido${validRows.length === 1 ? '' : 's'}`}
        </button>
        <a href="/dashboard/admin/matches/bulk" className="text-sm text-neutral-500 hover:underline">
          Cargar otro archivo
        </a>
      </form>
    </div>
  );
}

function ResultStep({ result }: { result: Extract<CommitState, { status: 'done' }> }) {
  const failedRows = result.results.filter((r) => r.status !== 'created');

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm font-semibold text-neutral-900">
        {result.created} partido{result.created === 1 ? '' : 's'} creado{result.created === 1 ? '' : 's'}
        {result.failed > 0 && `, ${result.failed} con error`}
      </p>

      {failedRows.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-neutral-700">No se crearon:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {failedRows.map((r, i) => (
              <li key={i} className="text-sm text-red-700">
                {r.description}: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex gap-3 text-sm">
        <a href="/dashboard/admin/matches/bulk" className="text-brand-blue hover:underline">
          Cargar otro archivo
        </a>
        <a href="/dashboard/admin/matches" className="text-neutral-500 hover:underline">
          Volver a Partidos
        </a>
      </div>
    </div>
  );
}

export function BulkUploadClient() {
  return <UploadStep />;
}
