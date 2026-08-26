import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/dashboard?error=unauthorized');
  }

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-white p-4">
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
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
