import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/activeMembership';
import { BulkUploadClient } from './BulkUploadClient';

export default async function BulkUploadPage() {
  const supabase = await createClient();
  await requireRole(supabase, 'admin');

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/admin/users" className="text-sm text-neutral-500 hover:underline">
        ← Volver a Usuarios
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">Carga masiva de usuarios</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Sube un CSV con las columnas nombre_completo, cedula, email, rol y posicion (esta última solo aplica a
        deportistas).
      </p>

      <a
        href="/api/admin/users/bulk-template"
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
