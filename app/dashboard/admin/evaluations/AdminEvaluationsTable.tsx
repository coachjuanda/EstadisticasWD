'use client';

import { useMemo, useState } from 'react';
import { dueStatusRank, type DueStatus } from '@/lib/evaluations/dueStatus';
import { DueStatusDot } from '../../DueStatusDot';

export type EvaluationRow = {
  id: string;
  athleteName: string;
  coachName: string;
  divisionName: string;
  reportDate: string;
  dueStatus: DueStatus;
};

type SortKey = 'dueStatus' | 'athleteName' | 'coachName' | 'divisionName' | 'reportDate';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'dueStatus', label: 'Vencimiento' },
  { key: 'athleteName', label: 'Deportista' },
  { key: 'coachName', label: 'Coach' },
  { key: 'divisionName', label: 'Categoría/Equipo' },
  { key: 'reportDate', label: 'Fecha' },
];

function sortValue(r: EvaluationRow, key: SortKey): string {
  if (key === 'dueStatus') return String(dueStatusRank(r.dueStatus));
  if (key === 'reportDate') return r.reportDate;
  return r[key].toLowerCase();
}

export function AdminEvaluationsTable({ reports }: { reports: EvaluationRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('reportDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const list = [...reports];
    list.sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [reports, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
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
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-neutral-100 last:border-0">
              <td className="px-3 py-2">
                <DueStatusDot status={r.dueStatus} />
              </td>
              <td className="px-3 py-2 font-medium text-neutral-900">{r.athleteName}</td>
              <td className="px-3 py-2 text-neutral-700">{r.coachName}</td>
              <td className="px-3 py-2 text-neutral-700">{r.divisionName}</td>
              <td className="px-3 py-2 text-neutral-700">
                {new Date(r.reportDate).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
              </td>
              <td className="px-3 py-2 text-xs">
                <a href={`/dashboard/evaluations/${r.id}`} className="text-brand-blue hover:underline">
                  Ver detalle
                </a>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-3 py-4 text-center text-neutral-500">
                No hay evaluaciones con ese filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
