import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BulkUploadClient } from './BulkUploadClient';

export default async function BulkMatchesUploadPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard?error=unauthorized');

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/admin/matches" className="text-sm text-neutral-500 hover:underline">
        ← Volver a Partidos
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">Carga masiva de partidos</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Sube un CSV con las columnas torneo, equipo_local, rival, fecha_hora, cancha_ubicacion y scorekeeper (esta
        última opcional). El equipo local debe tener nómina cargada en ese torneo.
      </p>

      <a
        href="/api/admin/matches/bulk-template"
        className="mt-3 inline-block rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
      >
        Descargar plantilla
      </a>

      <div className="mt-4">
        <BulkUploadClient />
      </div>
    </div>
  );
}
