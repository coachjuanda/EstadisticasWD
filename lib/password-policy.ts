export const MIN_PASSWORD_LENGTH = 10;

// Contraseñas triviales/predecibles que igual cumplirían un chequeo de solo
// longitud+charset (ej. "1234567890" tiene 10 caracteres y sería válida sin
// este check). Lista corta a propósito: esto es una barrera contra lo obvio,
// no un diccionario de fuerza bruta.
const COMMON_WEAK_PASSWORDS = new Set([
  '1234567890',
  '123456789',
  '12345678',
  '0123456789',
  'password',
  'password1',
  'contraseña',
  'contrasena',
  'qwertyuiop',
  'abcdefghij',
  '0000000000',
  '1111111111',
]);

// Reglas mínimas para una contraseña asignada manualmente por el admin --
// deben ser comparables a lo que ya garantiza generateTempPassword() (16
// caracteres de un alfabeto mixto), sin exigir exactamente lo mismo (un
// humano la tiene que poder escribir/recordar).
export function validateManualPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra y un número.';
  }
  if (/^(.)\1+$/.test(password)) {
    return 'La contraseña no puede ser el mismo carácter repetido.';
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return 'Esa contraseña es demasiado común o predecible, elige otra.';
  }
  return null;
}
