import { createClient } from '@/lib/supabase/server';
import { toCsv } from '@/lib/csv';

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return new Response('No autorizado', { status: 403 });

  const csv = toCsv([
    ['torneo', 'equipo_local', 'rival', 'fecha_hora', 'cancha_ubicacion', 'scorekeeper'],
    ['Copa Apertura', 'Mi Equipo U10', 'Rival FC', '2026-09-15 10:00', 'Coliseo Wild Dogs', 'Ana Pérez'],
    ['Copa Apertura', 'Mi Equipo U12', 'Otro Rival HC', '2026-09-16 14:30', '', ''],
  ]);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-partidos.csv"',
    },
  });
}
