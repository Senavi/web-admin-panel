import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { count } from 'drizzle-orm';

import { DATA_DIR } from '@/core/db/paths';
import { users } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { env } from '@/core/env';

import { generateTemporaryPassword } from '../password-policy';
import { Role } from '../roles';
import { createUserWithPassword, findUserByEmail } from './users';

export const DEV_CREDENTIALS_FILE = path.join(DATA_DIR, 'dev-admin-credentials.txt');
const DEFAULT_DEV_ADMIN_EMAIL = 'admin@localhost.test';

/**
 * Development only, never in production:
 * - with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD → creates that admin if missing;
 * - otherwise, when the database has no users → creates `admin@localhost.test`
 *   with a random password written to `.data/dev-admin-credentials.txt`
 *   (gitignored). No default credentials ship with the template.
 */
export async function seedDevAdmin(db: Database): Promise<void> {
  const { NODE_ENV, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = env();
  if (NODE_ENV === 'production') return;

  if (SEED_ADMIN_EMAIL && SEED_ADMIN_PASSWORD) {
    if (await findUserByEmail(db, SEED_ADMIN_EMAIL)) return;
    await createAdmin(db, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
    console.info(`[seed] Created development admin ${SEED_ADMIN_EMAIL}.`);
    return;
  }

  const [existing] = await db.select({ value: count() }).from(users);
  if ((existing?.value ?? 0) > 0) return;
  const password = generateTemporaryPassword(24);
  await createAdmin(db, DEFAULT_DEV_ADMIN_EMAIL, password);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    DEV_CREDENTIALS_FILE,
    `Development admin (local database only)\nemail: ${DEFAULT_DEV_ADMIN_EMAIL}\npassword: ${password}\n`,
    { mode: 0o600 },
  );
  console.info(
    `[seed] Created development admin ${DEFAULT_DEV_ADMIN_EMAIL}. Credentials: .data/dev-admin-credentials.txt`,
  );
}

function createAdmin(db: Database, email: string, password: string) {
  return createUserWithPassword(db, {
    email,
    name: 'Admin',
    role: Role.Admin,
    password,
    mustChangePassword: false,
  });
}
