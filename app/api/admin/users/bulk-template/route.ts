import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/activeMembership';
import { toCsv } from '@/lib/csv';

export async function GET() {
  const supabase = await createClient();

  const membership = await getActiveMembership(supabase);
  if (!membership) return new Response('No autorizado', { status: 401 });
  if (membership.role !== 'admin') return new Response('No autorizado', { status: 403 });

  const csv = toCsv([
    ['nombre_completo', 'cedula', 'email', 'rol', 'posicion'],
    ['Ana Pérez', '1234567890', 'ana.perez@example.com', 'deportista', 'jugador_de_campo'],
    ['Carlos Ruiz', '9876543210', 'carlos.ruiz@example.com', 'coach', ''],
  ]);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-usuarios.csv"',
    },
  });
}
