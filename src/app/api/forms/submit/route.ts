import { renderFallbackPage } from '@/core/forms/fallback-page';
import { FormHiddenField } from '@/core/forms/fields';
import {
  FORM_MAX_BODY_BYTES,
  FORM_SUBMIT_PATH,
  type FormSubmitResponse,
  JSON_ACCEPT,
} from '@/core/forms/paths';
import { processSubmission, withFreshToken } from '@/core/forms/process';
import { getSiteFormConfig } from '@/core/forms/site';
import { FormSubmitStatus } from '@/core/forms/state';
import { PAYLOAD_TOO_LARGE, parseFormData, readLimitedBody } from '@/core/http/body-limit';
import { NO_STORE } from '@/core/http/headers';
import { FORM_NOT_CONNECTED_MESSAGE, isPreviewMode } from '@/core/preview/mode';
import { safeRedirectPath } from '@/core/project/paths';
import { assertSameOrigin } from '@/core/security/origin';

/**
 * Every site form submission. Script submissions (`Accept: application/json`,
 * from `useSiteForm`) get the state as JSON; plain form posts (no JavaScript)
 * get a redirect (thank-you page) or a minimal HTML page. Bodies over
 * FORM_MAX_BODY_BYTES are refused with 413 before parsing.
 */
const SERVICE_UNAVAILABLE = 503;

export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  // Preview mode (no database): nothing can be stored or delivered yet.
  if (isPreviewMode()) return notConnectedResponse(request);
  const body = await readLimitedBody(request, FORM_MAX_BODY_BYTES);
  if (!body) {
    return new Response('Payload too large', {
      status: PAYLOAD_TOO_LARGE,
      headers: { 'Cache-Control': NO_STORE },
    });
  }
  let data: FormData;
  try {
    data = await parseFormData(request, body);
  } catch {
    return new Response('Bad request', { status: 400, headers: { 'Cache-Control': NO_STORE } });
  }
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

/** 503 "This form isn't connected yet": JSON for script submissions, a short page otherwise. */
function notConnectedResponse(request: Request): Response {
  const headers = { 'Cache-Control': NO_STORE, 'Retry-After': '3600' };
  if (request.headers.get('accept')?.includes(JSON_ACCEPT)) {
    const body: FormSubmitResponse = {
      state: { status: FormSubmitStatus.NotConnected },
      message: FORM_NOT_CONNECTED_MESSAGE,
    };
    return Response.json(body, { status: SERVICE_UNAVAILABLE, headers });
  }
  return new Response(FORM_NOT_CONNECTED_MESSAGE, {
    status: SERVICE_UNAVAILABLE,
    headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
