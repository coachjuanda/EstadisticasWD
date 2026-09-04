'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getPeopleByRole } from '@/lib/auth/activeMembership';
import { parseCsv } from '@/lib/csv';
import {
  validateRows,
  parseCsvRows,
  type BulkMatchRowInput,
  type BulkMatchRowValidated,
  type BulkMatchContext,
} from './validation';

async function requireAdmin() {
  const supabase = await createClient();
  const membership = await requireRole(supabase, 'admin');

  return { supabase, clubId: membership.clubId };
}

async function loadContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string
): Promise<BulkMatchContext> {
  const [{ data: tournaments }, { data: teams }, { data: rosters }, scorekeepers] = await Promise.all([
    supabase.from('tournaments').select('id, name').eq('club_id', clubId),
    supabase.from('teams').select('id, name').eq('club_id', clubId),
    supabase.from('rosters').select('team_id, tournament_id'),
    getPeopleByRole(supabase, 'scorekeeper', { activeOnly: true }),
  ]);

  const tournamentsByName = new Map((tournaments ?? []).map((t) => [t.name.toLowerCase(), t.id]));
  const teamsByName = new Map((teams ?? []).map((t) => [t.name.toLowerCase(), t.id]));
  const rosterPairs = new Set((rosters ?? []).map((r) => `${r.team_id}:${r.tournament_id}`));
  const scorekeepersByName = new Map((scorekeepers ?? []).map((s) => [s.full_name.toLowerCase(), s.id]));

  return { tournamentsByName, teamsByName, rosterPairs, scorekeepersByName };
}

export type PreviewState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'preview'; rows: BulkMatchRowValidated[] };

export async function previewBulkMatchesAction(_prevState: PreviewState, formData: FormData): Promise<PreviewState> {
  const { supabase, clubId } = await requireAdmin();

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

  const context = await loadContext(supabase, clubId);
  const rows = validateRows(parsed, context);

  return { status: 'preview', rows };
}

export type CommitResultRow = {
  description: string;
  status: 'created' | 'failed' | 'skipped';
  error?: string;
};

export type CommitState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'done'; created: number; failed: number; results: CommitResultRow[] };

export async function commitBulkMatchesAction(_prevState: CommitState, formData: FormData): Promise<CommitState> {
  const { supabase, clubId } = await requireAdmin();

  const rowsJson = formData.get('rows_json') as string;
  if (!rowsJson) {
    return { status: 'error', message: 'No hay filas para crear.' };
  }

  let rawRows: BulkMatchRowInput[];
  try {
    rawRows = JSON.parse(rowsJson);
  } catch {
    return { status: 'error', message: 'Datos de filas inválidos.' };
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { status: 'error', message: 'No hay filas para crear.' };
  }

  // Nunca se confía en el `valid` que mandó el cliente -- se revalida acá con
  // el estado real de la base en este momento (pudo cambiar desde que se
  // mostró la previsualización: un torneo borrado, una nómina modificada).
  const context = await loadContext(supabase, clubId);
  const revalidated = validateRows(rawRows, context);

  const results: CommitResultRow[] = [];

  for (const row of revalidated) {
    const description = `${row.torneo} — ${row.equipo_local} vs ${row.rival} — ${row.fecha_hora}`;

    if (!row.valid || !row.tournament_id || !row.home_team_id || !row.scheduled_at) {
      results.push({ description, status: 'skipped', error: row.errors.join(' ') });
      continue;
    }

    const { error } = await supabase.from('matches').insert({
      club_id: clubId,
      tournament_id: row.tournament_id,
      home_team_id: row.home_team_id,
      away_team_name: row.rival,
      scheduled_at: row.scheduled_at,
      location: row.cancha_ubicacion || null,
      scorekeeper_id: row.scorekeeper_id,
      status: 'programado',
    });

    if (error) {
      results.push({ description, status: 'failed', error: error.message });
      continue;
    }

    results.push({ description, status: 'created' });
  }

  const created = results.filter((r) => r.status === 'created').length;
  const failed = results.filter((r) => r.status !== 'created').length;

  revalidatePath('/dashboard/admin/matches');
  return { status: 'done', created, failed, results };
}
