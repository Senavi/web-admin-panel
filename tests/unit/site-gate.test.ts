import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { Role } from '@/core/auth/roles';
import { buildIco, generateFavicons } from '@/core/media/favicon';
import { sanitizeSvg } from '@/core/media/svg';
import { decideGate, isStaffToken } from '@/core/site-gate/staff';
import { isNoindex } from '@/core/site-gate/state';
import { signGateToken } from '@/core/site-gate/token';

const secret = 'gate-test-secret-that-is-long-enough-123';
const exp = Math.floor(Date.now() / 1000) + 3600;

describe('site gate', () => {
  it('maintenance beats private mode for visitors; staff bypass both', () => {
    expect(decideGate({ maintenance: true, privateMode: true }, false)).toEqual({
      type: 'maintenance',
    });
    expect(decideGate({ maintenance: false, privateMode: true }, false)).toEqual({
      type: 'private',
    });
    expect(decideGate({ maintenance: true, privateMode: true }, true)).toEqual({ type: 'allow' });
    expect(decideGate({ maintenance: false, privateMode: false }, false)).toEqual({
      type: 'allow',
    });
  });

  it('recognizes staff only with a valid token whose version matches the staff list', async () => {
    const token = await signGateToken(secret, { uid: 'u1', role: Role.Manager, v: 2, exp });
    expect(await isStaffToken(secret, token, { staff: { u1: 2 } })).toBe(true);
    expect(await isStaffToken(secret, token, { staff: { u1: 3 } })).toBe(false); // password changed
    expect(await isStaffToken(secret, token, { staff: {} })).toBe(false); // disabled / deleted
    expect(await isStaffToken(secret, 'forged.token', { staff: { u1: 2 } })).toBe(false);
    expect(await isStaffToken(secret, undefined, { staff: { u1: 2 } })).toBe(false);
  });

  it('forces noindex when indexing is off or the site is private', () => {
    expect(isNoindex({ indexing: true, privateMode: false })).toBe(false);
    expect(isNoindex({ indexing: false, privateMode: false })).toBe(true);
    expect(isNoindex({ indexing: true, privateMode: true })).toBe(true);
  });
});

describe('branding assets', () => {
  it('sanitizes logos and rejects dangerous SVG', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" onclick="x()"/><script>alert(1)</script></svg>',
    );
    expect(clean).not.toMatch(/script|onclick/i);
    expect(() =>
      sanitizeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
      ),
    ).toThrow();
    expect(() =>
      sanitizeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>',
      ),
    ).toThrow();
    expect(() => sanitizeSvg('not svg')).toThrow();
  });

  it('generates the favicon set with a valid ICO container', async () => {
    const source = await sharp({
      create: { width: 600, height: 600, channels: 4, background: '#2546ea' },
    })
      .png()
      .toBuffer();
    const files = await generateFavicons(source, '#ffffff');
    expect([...files.keys()].sort()).toEqual(
      [
        'apple-touch-icon.png',
        'favicon.ico',
        'icon-16.png',
        'icon-192.png',
        'icon-32.png',
        'icon-48.png',
        'icon-512.png',
      ].sort(),
    );
    expect((await sharp(files.get('apple-touch-icon.png')).metadata()).width).toBe(180);
    const ico = files.get('favicon.ico');
    expect(ico?.readUInt16LE(2)).toBe(1);
    expect(ico?.readUInt16LE(4)).toBe(3);
    expect(buildIco([]).length).toBe(6);
  });
});

describe('project CSP extension', () => {
  it('rejects unsafe CSP sources in project config', async () => {
    const { defineProjectConfig } = await import('@/core/project/define');
    const base = {
      name: 'x',
      supportedLocales: [{ code: 'en', label: 'English' }],
      defaultLocale: 'en',
    } as const;
    expect(() =>
      defineProjectConfig({ ...base, csp: { frameSrc: ['https://www.youtube-nocookie.com'] } }),
    ).not.toThrow();
    expect(() =>
      defineProjectConfig({ ...base, csp: { scriptSrc: ['https://a.com; script-src *'] } }),
    ).toThrow(/invalid CSP source/);
    expect(() =>
      defineProjectConfig({ ...base, csp: { scriptSrc: ['https://a.com https://b.com'] } }),
    ).toThrow(/invalid CSP source/);
    expect(() => defineProjectConfig({ ...base, csp: { scriptSrc: ['*'] } })).toThrow();
    expect(() => defineProjectConfig({ ...base, csp: { scriptSrc: ["'unsafe-eval'"] } })).toThrow(
      /unsafe CSP source/,
    );
    expect(() => defineProjectConfig({ ...base, csp: { scriptSrc: ['https:'] } })).toThrow(
      /unsafe CSP source/,
    );
    expect(() => defineProjectConfig({ ...base, csp: { imgSrc: ['data:'] } })).not.toThrow();
  });
});
