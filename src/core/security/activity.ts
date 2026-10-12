import 'server-only';

import { desc, inArray } from 'drizzle-orm';

import { auditLog, users } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import { auditSentence } from './audit-labels';
import { describeAuditTargets } from './audit-targets';

export interface ActivitySentence {
  readonly id: string;
  readonly ts: string;
  readonly text: string;
}

/** The latest audit entries as plain sentences ("Ann changed Home (uk)"). */
export async function recentActivity(db: Database, limit: number): Promise<ActivitySentence[]> {
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.ts)).limit(limit);
  const emails = [...new Set(rows.flatMap((row) => (row.actorEmail ? [row.actorEmail] : [])))];
  const [targets, people] = await Promise.all([
    describeAuditTargets(db, rows),
    emails.length > 0
      ? db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.email, emails))
      : Promise.resolve([]),
  ]);
  const names = new Map(people.map((person) => [person.email, person.name || person.email]));
  return rows.map((row) => ({
    id: row.id,
    ts: row.ts.toISOString(),
    text: auditSentence(
      row.action,
      row.actorEmail ? (names.get(row.actorEmail) ?? row.actorEmail) : null,
      row.target ? (targets.get(row.target) ?? row.target) : null,
      row.actorId !== null && row.target === `user:${row.actorId}`,
    ),
  }));
}
