'use client';

import { useMemo, useState } from 'react';
import { dueStatusRank, type DueStatus } from '@/lib/evaluations/dueStatus';
import { DueStatusDot } from '../../DueStatusDot';

export type AthleteEvalRow = {
  id: string;
  fullName: string;
  position: string | null;
  teamId: string;
  teamName: string;
  divisionId: string;
  lastReportId: string | null;
  lastReportDate: string | null;
  dueStatus: DueStatus;
};

const POSITION_LABELS: Record<string, string> = {
  jugador_de_campo: 'Jugador de campo',
  portero: 'Portero',
};

type SortKey = 'dueStatus' | 'fullName' | 'teamName' | 'position' | 'lastReportDate';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'dueStatus', label: 'Vencimiento' },
  { key: 'fullName', label: 'Nombre' },
  { key: 'teamName', label: 'Categoría/Equipo' },
  { key: 'position', label: 'Posición' },
  { key: 'lastReportDate', label: 'Última evaluación' },
];

function sortValue(a: AthleteEvalRow, key: SortKey): string {
  switch (key) {
    case 'dueStatus':
      // Rojo (más urgente) primero en orden ascendente.
      return String(dueStatusRank(a.dueStatus));
    case 'position':
      return a.position ? POSITION_LABELS[a.position] ?? a.position : '';
    case 'lastReportDate':
      // ISO (o vacío) ordena bien como string -- "Sin evaluación" siempre
      // queda antes que cualquier fecha real, sin importar la dirección.
      return a.lastReportDate ?? '';
    default:
      return (a[key] ?? '').toLowerCase();
  }
}

export function CoachEvaluationsTable({ athletes }: { athletes: AthleteEvalRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('fullName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const list = [...athletes];
    list.sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [athletes, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => handleSort(c.key)}
                  className="flex items-center gap-1 hover:text-neutral-900"
                >
                  {c.label}
                  {sortKey === c.key && <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.id} className="border-b border-neutral-100 last:border-0">
              <td className="px-3 py-2">
                <DueStatusDot status={a.dueStatus} />
              </td>
              <td className="px-3 py-2 font-medium text-neutral-900">{a.fullName}</td>
              <td className="px-3 py-2 text-neutral-700">{a.teamName}</td>
              <td className="px-3 py-2 text-neutral-700">
                {a.position ? POSITION_LABELS[a.position] ?? a.position : '—'}
              </td>
              <td className="px-3 py-2 text-neutral-700">
                {a.lastReportDate
                  ? new Date(a.lastReportDate).toLocaleDateString('es-CO', { dateStyle: 'medium' })
                  : 'Sin evaluación'}
              </td>
              <td className="px-3 py-2 text-xs">
                {a.lastReportId ? (
                  <a
                    href={`/dashboard/coach/evaluations/${a.lastReportId}/edit`}
                    className="text-brand-blue hover:underline"
                  >
                    Ver última
                  </a>
                ) : (
                  <a
                    href={`/dashboard/coach/evaluations/new/${a.id}?division_id=${a.divisionId}`}
                    className="text-brand-blue hover:underline"
                  >
                    Nueva evaluación
                  </a>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-3 py-4 text-center text-neutral-500">
                No hay deportistas con ese filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
