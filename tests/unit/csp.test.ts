import { describe, expect, it } from 'vitest';

import { adminCsp, staticPageCsp } from '@/core/security/headers';

const project = {
  scriptSrc: ['https://plausible.io'],
  frameSrc: ['https://www.youtube-nocookie.com'],
};

function directive(csp: string, name: string): string | undefined {
  return csp.split('; ').find((part) => part.startsWith(`${name} `));
}

describe('project CSP sources', () => {
  it('extends the site CSP only', () => {
    const site = staticPageCsp(project);
    expect(directive(site, 'script-src')).toContain('https://plausible.io');
    expect(directive(site, 'frame-src')).toBe("frame-src 'self' https://www.youtube-nocookie.com");
    expect(directive(site, 'frame-ancestors')).toBe("frame-ancestors 'none'");

    const admin = adminCsp('abc');
    expect(admin).not.toContain('plausible.io');
    expect(admin).not.toContain('youtube');
  });
});
