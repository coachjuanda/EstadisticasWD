// Mismo patrón visual que el acordeón de "Mis entrenamientos" del coach
// (app/dashboard/coach/training/page.tsx): <details>/<summary> nativos, sin
// JS -- el chevron rota vía CSS con el pseudo-selector group-open.
export function TournamentGroupAccordion({
  name,
  matchCount,
  defaultOpen,
  children,
}: {
  name: string;
  matchCount: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{name}</h2>
          <span className="text-xs text-neutral-400">
            {matchCount} partido{matchCount === 1 ? '' : 's'}
          </span>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}
