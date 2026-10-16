import { describe, expect, it } from 'vitest';

import {
  cleanFamily,
  colorGroups,
  contrastLevel,
  contrastRatio,
  DESKTOP_VIEWPORT,
  evalLength,
  MOBILE_VIEWPORT,
  parseHex,
  resolveTextStyle,
  utilityName,
} from '@/core/storybook/model';
import { checkStorybookSlot } from '@/core/storybook/slot';

describe('storybook model', () => {
  it('parses hex colors and computes WCAG contrast', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#2546ea')).toEqual([37, 70, 234]);
    expect(parseHex('rgb(2 6 23 / 0.6)')).toBeNull();
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('#fff', 'rgb(0 0 0 / 0.5)')).toBeNull();
    expect(contrastLevel(21)).toBe('AAA');
    expect(contrastLevel(4.5)).toBe('AA');
    expect(contrastLevel(3.2)).toBe('AA large');
    expect(contrastLevel(2)).toBe('Fail');
  });

  it('splits semantic colors from the palette and rates them against background and foreground', () => {
    const groups = colorGroups({
      brand600: '#2546ea',
      background: '#ffffff',
      foreground: '#0f172a',
      primary: '#2546ea',
      overlay: 'rgb(2 6 23 / 0.6)',
    });
    expect(groups.palette.map((swatch) => swatch.name)).toEqual(['brand600']);
    expect(groups.semantic.map((swatch) => swatch.name)).toEqual([
      'background',
      'foreground',
      'primary',
      'overlay',
    ]);
    const primary = groups.semantic.find((swatch) => swatch.name === 'primary');
    expect(primary?.onBackground).toBeGreaterThan(4.5);
    expect(groups.semantic.find((swatch) => swatch.name === 'overlay')?.onBackground).toBeNull();
  });

  it('evaluates token lengths for a viewport', () => {
    expect(evalLength('1rem', MOBILE_VIEWPORT)).toBe(16);
    expect(evalLength('0.8125rem', DESKTOP_VIEWPORT)).toBe(13);
    // Phone: preferred 1.6rem + 2.6vw = 25.6 + 9.75 = 35.35 → below the 36px minimum.
    expect(evalLength('clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)', MOBILE_VIEWPORT)).toBe(36);
    // Desktop: 25.6 + 33.28 = 58.88 → capped at 56px.
    expect(evalLength('clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)', DESKTOP_VIEWPORT)).toBe(56);
    expect(evalLength('clamp(1rem, 4vw, 2rem)', MOBILE_VIEWPORT)).toBe(16);
    expect(evalLength('var(--x)', MOBILE_VIEWPORT)).toBeNull();
  });

  it('resolves a text style for phone and desktop', () => {
    const style = resolveTextStyle('h1', {
      size: 'clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)',
      lineHeight: '1.08',
      letterSpacing: '-0.03em',
      weight: '800',
      family: 'var(--font-heading)',
    });
    expect(style.sizePx).toEqual({ mobile: 36, desktop: 56 });
    expect(style.lineHeightPx).toEqual({ mobile: 38.88, desktop: 60.48 });
    expect(style.letterSpacingPx).toEqual({ mobile: -1.08, desktop: -1.68 });
    expect(style.weight).toBe('800');
  });

  it('names utilities and cleans families', () => {
    expect(utilityName('bodyLg')).toBe('text-body-lg');
    expect(utilityName('h1')).toBe('text-h1');
    expect(cleanFamily('var(--font-family-heading)), ui-sans-serif')).toBe(
      'var(--font-family-heading), ui-sans-serif',
    );
  });
});

describe('storybook slot check', () => {
  const complete = `export const storybookSections = [
    { id: 'buttons' }, { id: "form-fields" }, { id: 'icons' },
  ];`;

  it('accepts a complete slot', () => {
    expect(checkStorybookSlot(complete)).toEqual([]);
  });

  it('reports a missing file, a missing export and missing sections', () => {
    expect(checkStorybookSlot(null)[0]).toMatch(/is missing/);
    expect(checkStorybookSlot("export const other = [{ id: 'buttons' }]")).toEqual(
      expect.arrayContaining([expect.stringMatching(/must export/)]),
    );
    expect(checkStorybookSlot("export const storybookSections = [{ id: 'buttons' }]")).toEqual([
      expect.stringContaining('"form-fields"'),
      expect.stringContaining('"icons"'),
    ]);
  });
});
