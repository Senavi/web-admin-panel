import 'server-only';

import { auditLog, type JsonObject } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import type { AuditAction } from './audit-actions';

export { AuditAction } from './audit-actions';

export interface AuditEntry {
  readonly action: AuditAction;
  readonly actor?: { readonly id: string; readonly email: string } | null;
  /** Free-form target reference, e.g. `user:<id>`, `page:home:uk`, `settings:general`. */
  readonly target?: string;
  /** Short, non-secret summary of the change. */
  readonly summary?: JsonObject;
  readonly ipHash?: string | null;
}

export async function writeAudit(db: Database, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    action: entry.action,
    actorId: entry.actor?.id ?? null,
    actorEmail: entry.actor?.email ?? null,
    target: entry.target ?? null,
    summary: entry.summary ?? null,
    ipHash: entry.ipHash ?? null,
  });
}
