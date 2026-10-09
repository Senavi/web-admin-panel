import 'server-only';

import { inArray } from 'drizzle-orm';

import { projectConfig } from '@project/config';

import { registry } from '@/content';
import { itemText } from '@/core/collections/repository';
import { contentRegistry } from '@/core/content/project-registry';
import { collectionItemStore } from '@/core/content/stores/table-store';
import { collectionItems, users } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

export interface AuditTargetRow {
  readonly target: string | null;
  /** Entry summary; deleted items are labeled with the title saved here. */
  readonly summary?: unknown;
}

function idsOf(rows: ReadonlyArray<AuditTargetRow>, prefix: string, part: number): string[] {
  return [
    ...new Set(
      rows.flatMap((row) =>
        row.target?.startsWith(`${prefix}:`) ? [row.target.split(':')[part] ?? ''] : [],
      ),
    ),
  ].filter(Boolean);
}

function summaryTitle(summary: unknown): string | null {
  if (typeof summary !== 'object' || summary === null || !('title' in summary)) return null;
  return typeof summary.title === 'string' && summary.title ? summary.title : null;
}

/** Current titles of collection items (default locale), keyed by item id. */
async function itemTitles(db: Database, itemIds: readonly string[]): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();
  const items = await db
    .select({ id: collectionItems.id, collectionId: collectionItems.collectionId })
    .from(collectionItems)
    .where(inArray(collectionItems.id, [...itemIds]));
  const titles = new Map<string, string>();
  for (const item of items) {
    const collection = contentRegistry.collectionById(item.collectionId);
    if (!collection) continue;
    const rows = await collectionItemStore.readRows(db, item.id, [projectConfig.defaultLocale]);
    const { defaultLocale } = projectConfig;
    titles.set(
      item.id,
      itemText(collection, rows, collection.titleField, defaultLocale, defaultLocale),
    );
  }
  return titles;
}

/**
 * Human-readable labels for audit targets (`user:<uuid>`, `page:home:uk`,
 * `item:blog:<uuid>`…), so the admin shows names instead of raw ids.
 */
export async function describeAuditTargets(
  db: Database,
  rows: ReadonlyArray<AuditTargetRow>,
): Promise<Map<string, string>> {
  const userIds = idsOf(rows, 'user', 1);
  const people = userIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const byId = new Map(people.map((person) => [person.id, `${person.name} (${person.email})`]));
  const titles = await itemTitles(db, idsOf(rows, 'item', 2));

  const labels = new Map<string, string>();
  for (const { target, summary } of rows) {
    if (!target || labels.has(target)) continue;
    if (target.startsWith('item:')) {
      const [, collectionId = '', itemId = ''] = target.split(':');
      const collection = contentRegistry.collectionById(collectionId);
      const title = titles.get(itemId) || summaryTitle(summary);
      const name = title ?? (titles.has(itemId) ? 'Untitled' : 'Deleted item');
      labels.set(target, `${collection?.label ?? collectionId}: ${name}`);
      continue;
    }
    labels.set(target, describeTarget(target, byId));
  }
  return labels;
}

function describeTarget(target: string, people: ReadonlyMap<string, string>): string {
  const [kind = '', id = '', extra] = target.split(':');
  switch (kind) {
    case 'user':
      return people.get(id) ?? 'Deleted user';
    case 'form': {
      const form = contentRegistry.formById(id);
      return `${form?.label ?? id}${extra ? ` (${extra})` : ''}`;
    }
    case 'global': {
      const global = contentRegistry.globalById(id);
      return `${global?.label ?? id}${extra ? ` (${extra})` : ''}`;
    }
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
