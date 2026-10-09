import { cookies } from 'next/headers';

import { DRAFT_MODE_COOKIE, draftCookieOptions } from '@/core/collections/gate';

import { NO_STORE } from '@/core/http/headers';
import { safeRedirectPath } from '@/core/project/paths';
import { assertSameOrigin } from '@/core/security/origin';

/** Leaves Draft Mode (form POST from the preview notice) and returns to the page (303 → GET). */
export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const form = await request.formData();
  const location = safeRedirectPath(form.get('returnTo'), '/');
  // The preview cookie is scoped to the item's path (see /api/preview).
  (await cookies()).set(DRAFT_MODE_COOKIE, '', {
    ...draftCookieOptions(new URL(location, request.url).pathname),
    maxAge: 0,
  });
  return new Response(null, {
    status: 303,
    headers: { Location: location, 'Cache-Control': NO_STORE },
  });
}
