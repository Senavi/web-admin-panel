import 'server-only';

import { and, count, desc, eq, inArray, ne, type SQL } from 'drizzle-orm';

import { humanizeKey } from '@/core/content/fields';
import { type DeliveryState, formSubmissions } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import { type AnyForm, FormFieldType } from './define';
import { InboxFilter, SubmissionStatus } from './inbox-status';

/** Admin inbox of a form (Pages → Forms). */

export { InboxFilter, SubmissionStatus } from './inbox-status';

export const INBOX_PAGE_SIZE = 25;
/** Submissions loaded for in-memory search and CSV export (newest first). */
export const INBOX_SCAN_LIMIT = 5000;

export interface InboxRow {
  readonly id: string;
  readonly createdAt: string;
  /** Name / email preview (first text and email fields). */
  readonly preview: string;
  readonly status: SubmissionStatus;
  readonly locale: string;
  readonly delivery: DeliveryState;
}

export interface Inbox {
  readonly rows: readonly InboxRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

function statusCondition(filter: InboxFilter): SQL | undefined {
  switch (filter) {
    case InboxFilter.Open:
      return ne(formSubmissions.status, SubmissionStatus.Archived);
    case InboxFilter.All:
      return undefined;
    case InboxFilter.New:
    case InboxFilter.Read:
    case InboxFilter.Archived:
      return eq(formSubmissions.status, filter);
  }
}

/** Short preview of a submission: values of the first text and email fields. */
export function previewOf(form: AnyForm, data: Readonly<Record<string, string | boolean>>): string {
  const pick = (type: string) =>
    Object.entries(form.fields).find(([key, field]) => field.type === type && data[key])?.[0];
  return [pick(FormFieldType.Text), pick(FormFieldType.Email)]
    .filter((key): key is string => Boolean(key))
    .map((key) => String(data[key]))
    .join(' · ');
}

function matches(data: Readonly<Record<string, string | boolean>>, needle: string): boolean {
  return Object.values(data).some(
    (value) => typeof value === 'string' && value.toLowerCase().includes(needle),
  );
}

async function scan(db: Database, form: AnyForm, filter: InboxFilter, search: string) {
  const rows = await db
    .select()
    .from(formSubmissions)
    .where(and(eq(formSubmissions.formId, form.id), statusCondition(filter)))
    .orderBy(desc(formSubmissions.createdAt))
    .limit(INBOX_SCAN_LIMIT);
  const needle = search.trim().toLowerCase();
  return needle ? rows.filter((row) => matches(row.data, needle)) : rows;
}

export async function loadInbox(
  db: Database,
  form: AnyForm,
  query: { readonly filter: InboxFilter; readonly search: string; readonly page: number },
): Promise<Inbox> {
  const rows = await scan(db, form, query.filter, query.search);
  const pageCount = Math.max(1, Math.ceil(rows.length / INBOX_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pageCount);
  return {
    rows: rows.slice((page - 1) * INBOX_PAGE_SIZE, page * INBOX_PAGE_SIZE).map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      preview: previewOf(form, row.data),
      status: row.status,
      locale: row.locale,
      delivery: row.delivery,
    })),
    total: rows.length,
    page,
    pageCount,
  };
}

export type SubmissionRow = typeof formSubmissions.$inferSelect;

export async function findSubmission(
  db: Database,
  formId: string,
  id: string,
): Promise<SubmissionRow | null> {
  const [row] = await db
    .select()
    .from(formSubmissions)
    .where(and(eq(formSubmissions.formId, formId), eq(formSubmissions.id, id)));
  return row ?? null;
}

/** New submissions per form (Pages sidebar, Overview). */
export async function countNew(
  db: Database,
  formIds: readonly string[],
): Promise<Record<string, number>> {
  if (formIds.length === 0) return {};
  const rows = await db
    .select({ formId: formSubmissions.formId, total: count() })
    .from(formSubmissions)
    .where(
      and(
        inArray(formSubmissions.formId, [...formIds]),
        eq(formSubmissions.status, SubmissionStatus.New),
      ),
    )
    .groupBy(formSubmissions.formId);
  return Object.fromEntries(rows.map((row) => [row.formId, row.total]));
}

/** Labels for the inbox and exports (definition labels; editor-facing, not localized). */
export function fieldLabels(form: AnyForm): Array<{ key: string; label: string }> {
  return Object.entries(form.fields).map(([key, field]) => ({
    key,
    label: field.label ?? humanizeKey(key),
  }));
}

/**
 * CSV cell: quoted, quotes doubled, and values that spreadsheets would run as
 * formulas (`=`, `+`, `-`, `@`, tab, CR) prefixed with `'`.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV of the filtered submissions (UTF-8 with BOM so spreadsheets detect the encoding). */
export async function exportCsv(
  db: Database,
  form: AnyForm,
  filter: InboxFilter,
  search: string,
): Promise<{ csv: string; count: number }> {
  const rows = await scan(db, form, filter, search);
  const labels = fieldLabels(form);
  const header = ['Received', 'Status', 'Language', 'Page', ...labels.map((item) => item.label)];
  const lines = rows.map((row) =>
    [
      row.createdAt.toISOString(),
      row.status,
      row.locale,
      row.pagePath ?? '',
      ...labels.map(({ key }) => {
        const value = row.data[key];
        return typeof value === 'boolean' ? (value ? 'yes' : 'no') : (value ?? '');
      }),
    ]
      .map(csvCell)
      .join(','),
  );
  return {
    csv: `﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`,
    count: rows.length,
  };
}
