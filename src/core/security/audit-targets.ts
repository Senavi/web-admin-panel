import 'server-only';

import { inArray } from 'drizzle-orm';

import { registry } from '@/content';
import { users } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

/**
 * Human-readable labels for audit targets (`user:<uuid>`, `page:home:uk`…), so
 * the admin shows names instead of raw ids. One query for all referenced users.
 */
export async function describeAuditTargets(
  db: Database,
  targets: ReadonlyArray<string | null>,
): Promise<Map<string, string>> {
  const userIds = [
    ...new Set(targets.flatMap((target) => (target?.startsWith('user:') ? [target.slice(5)] : []))),
  ];
  const people = userIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const byId = new Map(people.map((person) => [person.id, `${person.name} (${person.email})`]));

  const labels = new Map<string, string>();
  for (const target of targets) {
    if (!target || labels.has(target)) continue;
    labels.set(target, describeTarget(target, byId));
  }
  return labels;
}

function describeTarget(target: string, people: ReadonlyMap<string, string>): string {
  const [kind = '', id = '', extra] = target.split(':');
  switch (kind) {
    case 'user':
      return people.get(id) ?? 'Deleted user';
    case 'page': {
      const page = registry.byId(id);
      return `${page?.label ?? id}${extra ? ` (${extra})` : ''}`;
    }
    case 'settings':
      return `Settings · ${[id, extra].filter(Boolean).join(' · ')}`;
    case 'session':
      return 'A session';
    case 'sessions':
      return 'All sessions';
    case 'media':
      return 'An image';
    case 'email':
      return target.slice(6);
    case 'env':
      return id;
    default:
      return target;
  }
}
