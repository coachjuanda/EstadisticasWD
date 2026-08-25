'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTempPassword } from '@/lib/generate-password';
import { parseCsv } from '@/lib/csv';
import { validateRows, parseCsvRows, type BulkRowInput, type BulkRowValidated } from './validation';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, club_id').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard?error=unauthorized');

  return { supabase, clubId: profile.club_id as string };
}

async function existingCedulasAndEmails(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('profiles').select('cedula, email');
  const cedulas = new Set((data ?? []).map((p) => p.cedula));
  const emails = new Set((data ?? []).map((p) => p.email.toLowerCase()));
  return { cedulas, emails };
}

export type PreviewState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'preview'; rows: BulkRowValidated[] };

export async function previewBulkUsersAction(_prevState: PreviewState, formData: FormData): Promise<PreviewState> {
  const { supabase } = await requireAdmin();

  const file = formData.get('csv') as File | null;
  if (!file || file.size === 0) {
    return { status: 'error', message: 'Sube un archivo CSV.' };
  }

  const text = await file.text();
  const parsed = parseCsvRows(text, parseCsv);
  if ('columnError' in parsed) {
    return { status: 'error', message: parsed.columnError };
  }
  if (parsed.length === 0) {
    return { status: 'error', message: 'El CSV no tiene filas de datos.' };
  }

  const { cedulas, emails } = await existingCedulasAndEmails(supabase);
  const rows = validateRows(parsed, cedulas, emails);

  return { status: 'preview', rows };
}

export type CommitResultRow = {
  cedula: string;
  fullName: string;
  status: 'created' | 'failed' | 'skipped';
  password?: string;
  error?: string;
};

export type CommitState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'done'; created: number; failed: number; results: CommitResultRow[] };

export async function commitBulkUsersAction(_prevState: CommitState, formData: FormData): Promise<CommitState> {
  const { supabase, clubId } = await requireAdmin();

  const rowsJson = formData.get('rows_json') as string;
  if (!rowsJson) {
    return { status: 'error', message: 'No hay filas para crear.' };
  }

  let rawRows: BulkRowInput[];
  try {
    rawRows = JSON.parse(rowsJson);
  } catch {
    return { status: 'error', message: 'Datos de filas inválidos.' };
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { status: 'error', message: 'No hay filas para crear.' };
  }

  // Nunca confiamos en el `valid` que mandó el cliente -- se revalida acá
  // con el estado real de la base en este momento (pudo cambiar desde que
  // se mostró la previsualización).
  const { cedulas, emails } = await existingCedulasAndEmails(supabase);
  const revalidated = validateRows(rawRows, cedulas, emails);

  const admin = createAdminClient();
  const results: CommitResultRow[] = [];

  for (const row of revalidated) {
    if (!row.valid) {
      results.push({
        cedula: row.cedula,
        fullName: row.nombre_completo,
        status: 'skipped',
        error: row.errors.join(' '),
      });
      continue;
    }

    const password = generateTempPassword();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: row.email,
      password,
      email_confirm: true,
      user_metadata: { club_id: clubId, role: row.rol, full_name: row.nombre_completo, cedula: row.cedula },
    });

    if (error) {
      results.push({ cedula: row.cedula, fullName: row.nombre_completo, status: 'failed', error: error.message });
      continue;
    }

    if (row.rol === 'deportista') {
      await supabase.from('athlete_profiles').update({ position: row.posicion }).eq('id', created.user.id);
    }

    results.push({ cedula: row.cedula, fullName: row.nombre_completo, status: 'created', password });
  }

  const created = results.filter((r) => r.status === 'created').length;
  const failed = results.filter((r) => r.status !== 'created').length;

  revalidatePath('/dashboard/admin/users');
  return { status: 'done', created, failed, results };
}
