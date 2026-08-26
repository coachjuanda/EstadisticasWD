'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/dashboard/admin/divisions', label: 'Divisiones' },
  { href: '/dashboard/admin/teams', label: 'Equipos' },
  { href: '/dashboard/admin/leagues', label: 'Ligas' },
  { href: '/dashboard/admin/tournaments', label: 'Torneos' },
  { href: '/dashboard/admin/users', label: 'Usuarios' },
  { href: '/dashboard/admin/rosters', label: 'Nóminas' },
  { href: '/dashboard/admin/matches', label: 'Partidos' },
  { href: '/dashboard/admin/evaluations', label: 'Evaluaciones' },
  { href: '/dashboard/admin/training', label: 'Entrenamientos' },
  { href: '/dashboard/admin/surveys', label: 'Encuestas' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="flex min-h-full flex-1">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white p-4 transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:w-56 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Link href="/dashboard" className="flex items-center px-3">
          <Image src="/logo-hockeyone.png" alt="Hockey.One" width={112} height={67} />
        </Link>

        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 py-4">
          <Image src="/logo-wilddogs.png" alt="Wild Dogs" width={92} height={92} />
          <span className="text-sm font-semibold text-neutral-800">Wild Dogs</span>
        </div>

        <p className="mb-4 mt-4 border-t border-neutral-200 px-3 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Administración
        </p>
        <nav className="flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-brand-blue/5 hover:text-brand-blue"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/dashboard"
          className="mt-6 block px-3 text-sm text-neutral-500 hover:underline"
        >
          ← Volver al dashboard
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-neutral-200 bg-white p-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg p-2 text-neutral-700 hover:bg-neutral-100"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
              <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
              <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-w-0 flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}
