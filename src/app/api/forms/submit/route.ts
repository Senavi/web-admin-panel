import { renderFallbackPage } from '@/core/forms/fallback-page';
import { FormHiddenField } from '@/core/forms/fields';
import { FORM_SUBMIT_PATH, type FormSubmitResponse, JSON_ACCEPT } from '@/core/forms/paths';
import { processSubmission, withFreshToken } from '@/core/forms/process';
import { getSiteFormConfig } from '@/core/forms/site';
import { FormSubmitStatus } from '@/core/forms/state';
import { NO_STORE } from '@/core/http/headers';
import { safeRedirectPath } from '@/core/project/paths';
import { assertSameOrigin } from '@/core/security/origin';

/**
 * Every site form submission. Script submissions (`Accept: application/json`,
 * from `useSiteForm`) get the state as JSON; plain form posts (no JavaScript)
 * get a redirect (thank-you page) or a minimal HTML page.
 */
export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const data = await request.formData();
  const outcome = await processSubmission(data, request.headers);
  if (request.headers.get('accept')?.includes(JSON_ACCEPT)) {
    const body: FormSubmitResponse = {
      state: await withFreshToken(outcome),
      ...(outcome.redirectTo ? { redirectTo: outcome.redirectTo } : {}),
    };
    return Response.json(body, {
      status: outcome.state.status === FormSubmitStatus.RateLimited ? 429 : 200,
      headers: { 'Cache-Control': NO_STORE },
    });
  }
  if (outcome.redirectTo) {
    return new Response(null, {
      status: 303,
      headers: { Location: outcome.redirectTo, 'Cache-Control': NO_STORE },
    });
  }
  if (!outcome.form) return new Response('Not found', { status: 404 });
  const config = await getSiteFormConfig(outcome.form.id, outcome.locale);
  const html = renderFallbackPage({
    config,
    state: await withFreshToken(outcome),
    backHref: safeRedirectPath(data.get(FormHiddenField.Page), '/'),
    action: FORM_SUBMIT_PATH,
  });
  return new Response(html, {
    status: outcome.state.status === FormSubmitStatus.RateLimited ? 429 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': NO_STORE },
  });
}
