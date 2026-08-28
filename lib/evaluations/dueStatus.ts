export type DueStatus = 'red' | 'yellow' | 'green';

const YELLOW_THRESHOLD_DAYS = 10;
const MONTHS_UNTIL_DUE = 2;

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Sin fecha límite fijada por el admin: cada deportista vence individualmente
// a los 2 meses de su última evaluación (aritmética de mes calendario, no
// una duración fija en días -- así un mes de 31 días no corre distinto que
// uno de 28). Con fecha límite fijada: esa misma fecha aplica a todos, sin
// importar la última evaluación de cada quien.
export function computeDueStatus(
  lastEvaluationDate: string | null,
  fixedDeadline: string | null,
  today: Date = new Date()
): DueStatus {
  let targetDate: Date;

  if (fixedDeadline) {
    targetDate = new Date(`${fixedDeadline}T00:00:00`);
  } else {
    if (!lastEvaluationDate) return 'red';
    targetDate = new Date(`${lastEvaluationDate}T00:00:00`);
    targetDate.setMonth(targetDate.getMonth() + MONTHS_UNTIL_DUE);
  }

  const daysLeft = daysBetween(atMidnight(today), atMidnight(targetDate));

  if (daysLeft < 0) return 'red';
  if (daysLeft <= YELLOW_THRESHOLD_DAYS) return 'yellow';
  return 'green';
}

// Para ordenar por semáforo: rojo (más urgente) primero en orden ascendente.
export function dueStatusRank(status: DueStatus): number {
  return status === 'red' ? 0 : status === 'yellow' ? 1 : 2;
}
