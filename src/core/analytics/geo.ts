/**
 * Visitor country from hosting-platform headers (Vercel, Netlify, Cloudflare).
 * Returns an ISO 3166-1 alpha-2 code or null. No IP geolocation is performed.
 */
export function countryFromHeaders(headers: Headers): string | null {
  const direct =
    headers.get('x-vercel-ip-country') ?? headers.get('x-country') ?? headers.get('cf-ipcountry');
  if (direct && /^[A-Z]{2}$/i.test(direct) && direct.toUpperCase() !== 'XX')
    return direct.toUpperCase();
  const netlify = headers.get('x-nf-geo');
  if (netlify) {
    try {
      const json = JSON.parse(Buffer.from(netlify, 'base64').toString('utf8')) as {
        country?: { code?: string };
      };
      const code = json.country?.code;
      if (code && /^[A-Z]{2}$/i.test(code)) return code.toUpperCase();
    } catch {
      // Malformed header: ignore.
    }
  }
  return null;
}
