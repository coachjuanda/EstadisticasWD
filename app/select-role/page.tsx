import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMemberships, type UserRole } from '@/lib/auth/activeMembership';
import { selectRoleAction } from './actions';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  coach: 'Coach',
  scorekeeper: 'Anotador',
  deportista: 'Deportista',
};

export default async function SelectRolePage({
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

  const memberships = await getMemberships(supabase);

  // Con 0 o 1 rol no hay nada que elegir -- no debería llegar acá, pero por
  // si acaso no se le muestra un selector con un solo botón.
  if (memberships.length <= 1) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <Image src="/logo-hockeyone.png" alt="Hockey.One" width={168} height={101} priority />
        </div>
        <p className="mt-4 text-center text-sm text-neutral-500">¿Cómo quieres entrar?</p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {memberships.map((m) => (
            <form key={m.id} action={selectRoleAction}>
              <input type="hidden" name="membership_id" value={m.id} />
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-hover"
              >
                Entrar como {ROLE_LABELS[m.role]}
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
