import type { DueStatus } from '@/lib/evaluations/dueStatus';

const COLOR_CLASSES: Record<DueStatus, string> = {
  red: 'bg-red-500',
  yellow: 'bg-amber-400',
  green: 'bg-green-500',
};

const LABELS: Record<DueStatus, string> = {
  red: 'Evaluación vencida',
  yellow: 'Por vencer (10 días o menos)',
  green: 'Al día',
};

export function DueStatusDot({ status }: { status: DueStatus }) {
  return (
    <span
      role="img"
      aria-label={LABELS[status]}
      title={LABELS[status]}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_CLASSES[status]}`}
    />
  );
}
