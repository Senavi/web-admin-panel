/**
 * Netlify Scheduled Function: calls the app's maintenance endpoint daily.
 * Needs CRON_SECRET and URL (set by Netlify) in the site environment.
 */

export default async function maintenance(): Promise<Response> {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response('CRON_SECRET or URL missing', { status: 500 });
  const response = await fetch(`${base}/api/cron/maintenance`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  return new Response(await response.text(), { status: response.status });
}

// Netlify reads the schedule from this export (no @netlify/functions dependency needed).
export const config = { schedule: '17 3 * * *' };
