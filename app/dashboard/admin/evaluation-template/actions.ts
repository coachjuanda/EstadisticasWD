'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const BASE_PATH = '/dashboard/admin/evaluation-template';

// RLS ya exige rol admin para insert/update/delete en evaluation_blocks /
// evaluation_items -- esta capa no repite ese chequeo, solo traduce errores
// de Postgres a mensajes legibles (mismo patrón que admin/divisions).
function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23505') {
    return 'Ya existe un bloque o ítem con esa clave.';
  }
  return error.message;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

async function uniqueKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: 'evaluation_blocks' | 'evaluation_items',
  base: string,
  scope?: { column: string; value: string }
) {
  let query = supabase.from(table).select('key').like('key', `${base}%`);
  if (scope) query = query.eq(scope.column, scope.value);
  const { data } = await query;
  const existing = new Set((data ?? []).map((r) => r.key as string));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export async function createBlock(formData: FormData) {
  const label = (formData.get('label') as string)?.trim();
  const applies_to = formData.get('applies_to') as string;

  if (!label || !applies_to) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Nombre y a quién aplica son obligatorios.')}`);
  }

  const supabase = await createClient();

  const { data: existingBlocks } = await supabase.from('evaluation_blocks').select('sort_order');
  const sort_order = (existingBlocks ?? []).reduce((max, b) => Math.max(max, b.sort_order), 0) + 1;
  const key = await uniqueKey(supabase, 'evaluation_blocks', slugify(label) || 'bloque');

  const { error } = await supabase.from('evaluation_blocks').insert({ key, label, applies_to, sort_order });

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateBlock(formData: FormData) {
  const id = formData.get('id') as string;
  const label = (formData.get('label') as string)?.trim();
  const applies_to = formData.get('applies_to') as string;

  if (!id || !label || !applies_to) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Datos incompletos.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('evaluation_blocks').update({ label, applies_to }).eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function toggleBlockActive(formData: FormData) {
  const id = formData.get('id') as string;
  const next = formData.get('next') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.from('evaluation_blocks').update({ is_active: next }).eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function moveBlock(formData: FormData) {
  const id = formData.get('id') as string;
  const direction = formData.get('direction') as 'up' | 'down';

  const supabase = await createClient();
  const { data: blocks } = await supabase
    .from('evaluation_blocks')
    .select('id, sort_order')
    .order('sort_order');

  const list = blocks ?? [];
  const idx = list.findIndex((b) => b.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;

  if (idx === -1 || targetIdx < 0 || targetIdx >= list.length) {
    redirect(BASE_PATH);
  }

  const current = list[idx];
  const target = list[targetIdx];

  await supabase.from('evaluation_blocks').update({ sort_order: target.sort_order }).eq('id', current.id);
  await supabase.from('evaluation_blocks').update({ sort_order: current.sort_order }).eq('id', target.id);

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function createItem(formData: FormData) {
  const block_id = formData.get('block_id') as string;
  const label = (formData.get('label') as string)?.trim();

  if (!block_id || !label) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Falta el bloque o el nombre del ítem.')}`);
  }

  const supabase = await createClient();

  const { data: existingItems } = await supabase
    .from('evaluation_items')
    .select('sort_order')
    .eq('block_id', block_id);
  const sort_order = (existingItems ?? []).reduce((max, i) => Math.max(max, i.sort_order), 0) + 1;
  const key = await uniqueKey(supabase, 'evaluation_items', slugify(label) || 'item', {
    column: 'block_id',
    value: block_id,
  });

  const { error } = await supabase.from('evaluation_items').insert({ block_id, key, label, sort_order });

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateItem(formData: FormData) {
  const id = formData.get('id') as string;
  const label = (formData.get('label') as string)?.trim();

  if (!id || !label) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Datos incompletos.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('evaluation_items').update({ label }).eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function toggleItemActive(formData: FormData) {
  const id = formData.get('id') as string;
  const next = formData.get('next') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.from('evaluation_items').update({ is_active: next }).eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(friendlyError(error))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function moveItem(formData: FormData) {
  const id = formData.get('id') as string;
  const block_id = formData.get('block_id') as string;
  const direction = formData.get('direction') as 'up' | 'down';

  const supabase = await createClient();
  const { data: items } = await supabase
    .from('evaluation_items')
    .select('id, sort_order')
    .eq('block_id', block_id)
    .order('sort_order');

  const list = items ?? [];
  const idx = list.findIndex((i) => i.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;

  if (idx === -1 || targetIdx < 0 || targetIdx >= list.length) {
    redirect(BASE_PATH);
  }

  const current = list[idx];
  const target = list[targetIdx];

  await supabase.from('evaluation_items').update({ sort_order: target.sort_order }).eq('id', current.id);
  await supabase.from('evaluation_items').update({ sort_order: current.sort_order }).eq('id', target.id);

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
