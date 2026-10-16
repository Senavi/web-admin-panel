import 'server-only';

import { notFound } from 'next/navigation';

import { getCurrentUser } from '@/core/auth/server/session';
import { isPreviewMode } from '@/core/preview/mode';

/**
 * `/storybook` is for staff: any valid admin session (any role). Everyone else
 * gets the site's 404, never a login redirect, so the page's existence isn't
 * revealed. The request proxy already answers visitors with the site 404; this
 * guard is the authoritative check on the page itself.
 */
export async function requireStaffOrNotFound(): Promise<void> {
  // No database in preview mode: there are no accounts, so no staff.
  if (isPreviewMode()) notFound();
  const user = await getCurrentUser();
  if (!user) notFound();
}
