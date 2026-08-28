import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InstallAppCard } from './InstallAppCard';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-white px-4">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo-wilddogs.png"
            alt="Wild Dogs"
            width={192}
            height={192}
            priority
            className="size-32 sm:size-40 md:size-48"
          />
        </div>
        {error === 'unauthorized' && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            No autorizado: no tienes permiso para entrar ahí.
          </p>
        )}
        <h1 className="text-2xl font-semibold text-neutral-900">
          Bienvenido, {profile?.full_name ?? user.email}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Rol: {profile?.role ?? 'desconocido'}
        </p>
        {profile?.role === 'admin' && (
          <Link
            href="/dashboard/admin/divisions"
            className="mt-6 inline-block rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
          >
            Ir al panel de administración
          </Link>
        )}
        {profile?.role === 'scorekeeper' && (
          <Link
            href="/dashboard/scorekeeper"
            className="mt-6 inline-block rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
          >
            Ver mis partidos
          </Link>
        )}
        {profile?.role === 'coach' && (
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard/coach/evaluations"
              className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
            >
              Evaluaciones de mis jugadores
            </Link>
            <Link
              href="/dashboard/coach/matches"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Mis equipos y partidos
            </Link>
            <Link
              href="/dashboard/coach/training"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Entrenamientos
            </Link>
          </div>
        )}
        {profile?.role === 'deportista' && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/athlete/evaluations"
              className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
            >
              Ver mis evaluaciones
            </Link>
            <Link
              href="/dashboard/athlete/profile"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Mi perfil
            </Link>
            <Link
              href="/dashboard/athlete/matches"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Mis partidos
            </Link>
            <Link
              href="/dashboard/athlete/surveys"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Encuestas
            </Link>
          </div>
        )}
        <InstallAppCard />
      </div>
    </main>
  );
}
