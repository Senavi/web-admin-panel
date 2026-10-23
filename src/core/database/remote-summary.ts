/**
 * What an online database already holds before "Copy my local content" (Connect
 * Supabase wizard). Client-safe: no server imports.
 */
export interface RemoteContentSummary {
  readonly users: number;
  readonly contentRows: number;
  readonly items: number;
  readonly images: number;
  readonly submissions: number;
}

/** True when the online database has content of its own (copying then keeps what is there). */
export function hasRemoteContent(summary: RemoteContentSummary): boolean {
  return Object.values(summary).some((count) => count > 0);
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "2 users, 34 content rows and 5 images" (only the non-zero parts). */
export function describeRemoteContent(summary: RemoteContentSummary): string {
  const parts = [
    summary.users > 0 ? plural(summary.users, 'user', 'users') : null,
    summary.contentRows > 0 ? plural(summary.contentRows, 'content row', 'content rows') : null,
    summary.items > 0 ? plural(summary.items, 'blog/list item', 'blog/list items') : null,
    summary.images > 0 ? plural(summary.images, 'image', 'images') : null,
    summary.submissions > 0 ? plural(summary.submissions, 'form request', 'form requests') : null,
  ].filter((part): part is string => part !== null);
  if (parts.length <= 1) return parts[0] ?? 'nothing';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
