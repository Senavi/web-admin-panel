import 'server-only';

import { after } from 'next/server';
import { cache } from 'react';

/**
 * Development-only request timings: wrap a step in `timed('db:inbox', …)` and
 * one `Server-Timing:` line per request is logged once the response is done,
 * e.g. `Server-Timing: session;dur=4, db:settings;dur=2, db:inbox;dur=11`.
 * (Pages can't set response headers, so the value is logged in the header's
 * format.) Off in production unless `SERVER_TIMING=true`; a no-op wrapper then.
 */
const ENABLED = process.env.NODE_ENV !== 'production' || process.env.SERVER_TIMING === 'true';

interface Span {
  readonly label: string;
  readonly ms: number;
}

/** Spans of the current request; logged after the response (per render, via React `cache`). */
const requestSpans = cache((): Span[] => {
  const spans: Span[] = [];
  try {
    after(() => {
      if (spans.length === 0) return;
      console.info(
        `Server-Timing: ${spans.map((span) => `${span.label};dur=${span.ms}`).join(', ')}`,
      );
    });
  } catch {
    // Outside a request (scripts, build): nothing to report.
  }
  return spans;
});

export async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  if (!ENABLED) return run();
  const started = performance.now();
  try {
    return await run();
  } finally {
    requestSpans().push({ label, ms: Math.round(performance.now() - started) });
  }
}
