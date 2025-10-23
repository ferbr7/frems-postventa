import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const CODE_TTL_MIN = 10;   // minutos de vigencia
export const MAX_ATTEMPTS = 5;    // intentos permitidos

export function genCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

export function hashCode(code: string) {
  return bcrypt.hash(code, 10);
}

export function compareCode(code: string, hash: string) {
  return bcrypt.compare(code, hash);
}
