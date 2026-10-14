import { afterEach, describe, expect, it, vi } from 'vitest';

const STATE = {
  defaultLocale: 'en',
  enabledLocales: ['en'],
  supportedLocales: ['en'],
  maintenance: false,
  privateMode: true,
  indexing: false,
  staff: {},
  routes: ['/'],
};

async function freshClient(ttlMs = 0) {
  vi.resetModules();
  process.env.AUTH_SECRET = 'state-client-test-secret-0123456789abcdef';
  process.env.SITE_STATE_TTL_MS = String(ttlMs);
  return import('@/core/site-gate/state-client');
}

const json = (value: unknown) => new Response(JSON.stringify(value));

describe('site state client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fails closed (null) when the state is unknown and the endpoint fails', async () => {
    const { getSiteState } = await freshClient();
    const fetchMock = vi.fn().mockRejectedValue(new Error('timeout'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(getSiteState('http://localhost')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2); // one retry
  });

  it('keeps using the last known state when a later refresh fails', async () => {
    const { getSiteState } = await freshClient();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(STATE))));
    await expect(getSiteState('http://localhost')).resolves.toMatchObject({ privateMode: true });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(getSiteState('http://localhost')).resolves.toMatchObject({ privateMode: true });
  });

  it('serves the cached state immediately and refreshes in the background when stale', async () => {
    const { getSiteState } = await freshClient(0);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(STATE)));
    await getSiteState('http://localhost');
    // The next refresh hangs: the request must not wait for it.
    let release: (value: Response) => void = () => undefined;
    const slow = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
    vi.stubGlobal('fetch', slow);
    await expect(getSiteState('http://localhost')).resolves.toMatchObject({ privateMode: true });
    await vi.waitFor(() => expect(slow).toHaveBeenCalledTimes(1));
    release(json({ ...STATE, privateMode: false }));
    await vi.waitFor(async () =>
      expect(await getSiteState('http://localhost')).toMatchObject({ privateMode: false }),
    );
  });

  it('within the TTL, reloads only for a browser that changed the state after it was loaded', async () => {
    const { getSiteState } = await freshClient(60_000);
    const fetchMock = vi.fn().mockResolvedValue(json(STATE));
    vi.stubGlobal('fetch', fetchMock);
    await getSiteState('http://localhost');
    await getSiteState('http://localhost', { changedAt: Date.now() - 60_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1); // older change: cached state is newer
    fetchMock.mockResolvedValue(json({ ...STATE, maintenance: true }));
    await expect(
      getSiteState('http://localhost', { changedAt: Date.now() + 1 }),
    ).resolves.toMatchObject({ maintenance: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts only recent, non-future version cookies', async () => {
    const { parseStateVersion } = await freshClient();
    const now = 1_000_000_000_000;
    expect(parseStateVersion(String(now - 1000), now)).toBe(now - 1000);
    expect(parseStateVersion(String(now + 60_000), now)).toBe(0);
    expect(parseStateVersion(String(now - 3_600_000), now)).toBe(0);
    expect(parseStateVersion('nope', now)).toBe(0);
    expect(parseStateVersion(undefined, now)).toBe(0);
  });
});
