// `pnpm admin:create <email> [owner|editor|viewer]`: creates an admin (or resets their password)
// and prints a generated password once. Use it to create the first owner.
import { AdminRole } from '@survey-dynata/shared/db';
import { z } from 'zod';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import { audit } from './audit.js';
import { generatePassword, hashPassword } from './passwords.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment.
}

const args = z
  .tuple([z.email(), z.enum(AdminRole).default('owner')])
  .safeParse([process.argv[2], process.argv[3]]);
if (!args.success) {
  console.error('Usage: pnpm admin:create <email> [owner|editor|viewer]');
  process.exit(1);
}
const [email, role] = [args.data[0].toLowerCase(), args.data[1]];

const db = createDb(loadEnv().DATABASE_URL);
try {
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const admin = await db.adminUser.upsert({
    where: { email },
    create: { email, role, passwordHash },
    update: { role, passwordHash },
  });
  // A new password ends all existing sessions.
  await db.adminSession.deleteMany({ where: { adminUserId: admin.id } });
  await audit(db, null, 'admin_created_via_cli', email, { role });
  console.log(`Admin ${email} (${role}) is ready. Password (shown once): ${password}`);
} finally {
  await db.$disconnect();
}
