'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Polling simple para la vista pública: sin websockets (sección 7 del
// brief lo permite explícitamente), solo refresca la ruta cada pocos
// segundos para que el Server Component vuelva a leer las vistas públicas.
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
