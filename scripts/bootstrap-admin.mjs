// Bootstrap de un solo uso: crea el club real y el primer usuario admin.
// Corre con: node --env-file=.env.local scripts/bootstrap-admin.mjs
// Requiere SUPABASE_SERVICE_ROLE_KEY (bypassa RLS a propósito, solo para
// este arranque inicial -- nunca se usa así desde la app en producción).

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const CLUB_NAME = 'Rinos / Wild Dogs Hockey Club';
const ADMIN_FULL_NAME = 'Juan David Vinueza';
const ADMIN_CEDULA = '1127226808';
const ADMIN_EMAIL = 'coachjuanda@gmail.com';
const CREDENTIALS_FILE = new URL('../.admin_credentials_LOCAL.txt', import.meta.url);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generatePassword(length = 20) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function main() {
  const { data: existingClub } = await supabase
    .from('clubs')
    .select('id')
    .eq('name', CLUB_NAME)
    .maybeSingle();

  let clubId = existingClub?.id;

  if (!clubId) {
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({ name: CLUB_NAME })
      .select('id')
      .single();

    if (clubError) {
      console.error('Error creando el club:', clubError.message);
      process.exit(1);
    }
    clubId = club.id;
    console.log(`Club creado: "${CLUB_NAME}" (${clubId})`);
  } else {
    console.log(`Club ya existía: "${CLUB_NAME}" (${clubId})`);
  }

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingAdmin = existingUsers?.users?.find((u) => u.email === ADMIN_EMAIL);

  if (existingAdmin) {
    console.log(`El usuario admin ${ADMIN_EMAIL} ya existía (${existingAdmin.id}). No se creó de nuevo ni se generó contraseña.`);
    return;
  }

  const password = generatePassword();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: {
      club_id: clubId,
      role: 'admin',
      full_name: ADMIN_FULL_NAME,
      cedula: ADMIN_CEDULA,
    },
  });

  if (createError) {
    console.error('Error creando el usuario admin:', createError.message);
    process.exit(1);
  }

  writeFileSync(
    CREDENTIALS_FILE,
    `Credenciales del primer admin — NO subir a git (ya está en .gitignore)\n` +
      `Generado: ${new Date().toISOString()}\n\n` +
      `cedula: ${ADMIN_CEDULA}\n` +
      `email: ${ADMIN_EMAIL}\n` +
      `password: ${password}\n`,
    { mode: 0o600 }
  );

  console.log(`Usuario admin creado: ${ADMIN_EMAIL} (${created.user.id})`);
  console.log(`Contraseña guardada en ${CREDENTIALS_FILE.pathname}`);
}

main();
