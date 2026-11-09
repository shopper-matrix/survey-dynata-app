import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// Argon2id (library defaults follow OWASP guidance). Passwords are never stored or logged.

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false; // Malformed hash: treat as a wrong password.
  }
}

/** A hash to verify against when the email is unknown, so both cases take the same time. */
export const timingDummyHash: Promise<string> = hashPassword(randomBytes(16).toString('hex'));

/** A strong random password for newly created admins (shown once). */
export function generatePassword(): string {
  return randomBytes(18).toString('base64url');
}
