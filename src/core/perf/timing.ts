import 'server-only';

/**
 * Development-only timings: wrap a step in `timed('db:inbox', …)` and one
 * `Server-Timing:` line is logged per step, e.g. `Server-Timing: db:inbox;dur=11`
 * (pages can't set response headers, so the value is logged in the header's
 * format). Uses `performance.now()` only, which is safe while Next prerenders.
 * Off in production unless `SERVER_TIMING=true`; a no-op wrapper then.
 */
const ENABLED = process.env.NODE_ENV !== 'production' || process.env.SERVER_TIMING === 'true';

export async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  if (!ENABLED) return run();
  const started = performance.now();
  try {
    return await run();
  } finally {
    console.info(`Server-Timing: ${label};dur=${Math.round(performance.now() - started)}`);
  }
}
