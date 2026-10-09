import { contentRegistry } from '@/core/content/project-registry';
import { issueFormToken } from '@/core/forms/spam';
import { NO_STORE } from '@/core/http/headers';

/**
 * Signed timing token for a hydrated site form (minimum fill time). Public by
 * design: a token only proves that a few seconds passed before submitting.
 */
export async function GET(request: Request): Promise<Response> {
  const formId = new URL(request.url).searchParams.get('form') ?? '';
  const form = contentRegistry.formById(formId);
  if (!form)
    return Response.json({ token: null }, { status: 404, headers: { 'Cache-Control': NO_STORE } });
  return Response.json(
    { token: await issueFormToken(form.id) },
    { headers: { 'Cache-Control': NO_STORE, 'X-Robots-Tag': 'noindex' } },
  );
}
