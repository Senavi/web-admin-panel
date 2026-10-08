/**
 * Origin check for mutating route handlers (server actions have Next.js's
 * built-in protection). Returns a 403 response when the request comes from
 * another origin, or null when it is allowed.
 */
export function assertSameOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host) return new Response('Forbidden', { status: 403 });
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    // Malformed origin header.
  }
  return new Response('Forbidden', { status: 403 });
}
