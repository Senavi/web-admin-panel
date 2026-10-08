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

async function freshClient() {
  vi.resetModules();
  process.env.AUTH_SECRET = 'state-client-test-secret-0123456789abcdef';
  process.env.SITE_STATE_TTL_MS = '0';
  return import('@/core/site-gate/state-client');
}

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
});
