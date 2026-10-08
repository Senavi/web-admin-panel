/**
 * Creates an admin (or manager) user. There is no public sign-up.
 *
 *   pnpm admin:create                      # interactive
 *   pnpm admin:create --email a@b.com --name "Jane" --role admin
 *     (password from the ADMIN_PASSWORD env var, prompted otherwise)
 *
 * Uses DATABASE_URL / DIRECT_URL when set (production), else local PGlite.
 */
import { checkPassword } from '@/core/auth/password-policy';
import { isRole, Role } from '@/core/auth/roles';
import { createUserWithPassword, findUserByEmail } from '@/core/auth/server/users';
import { emailSchema } from '@/core/auth/validation';
import { AuditAction, writeAudit } from '@/core/security/audit';

import { openScriptDb, runScript } from './lib/db';
import { ask, parseFlags } from './lib/prompt';

runScript(async () => {
  const flags = parseFlags(process.argv.slice(2));
  const email = emailSchema.parse(flags.email ?? (await ask('Email')));
  const name = flags.name ?? (await ask('Name', { defaultValue: 'Admin' }));
  const role = flags.role ?? (await ask('Role (admin|manager)', { defaultValue: Role.Admin }));
  if (!isRole(role)) throw new Error(`Unknown role "${role}".`);

  let password = process.env.ADMIN_PASSWORD ?? '';
  if (!password) {
    password = await ask('Password (min 12 chars)', { hidden: true });
    const confirmation = await ask('Repeat password', { hidden: true });
    if (password !== confirmation) throw new Error('Passwords do not match.');
  }
  const check = checkPassword(password, { email });
  if (!check.ok) throw new Error(check.message);

  const { db, label, close } = await openScriptDb();
  try {
    if (await findUserByEmail(db, email))
      throw new Error(`A user with email ${email} already exists.`);
    const user = await createUserWithPassword(db, {
      email,
      name,
      role,
      password,
      mustChangePassword: false,
    });
    await writeAudit(db, {
      action: AuditAction.UserCreate,
      target: `user:${user.id}`,
      summary: { via: 'cli', role },
    });
    console.info(`Created ${role} ${email} in ${label}.`);
  } finally {
    await close();
  }
});
