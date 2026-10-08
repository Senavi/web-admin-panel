import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { groupTokens, parseCustomProperties, resolveTokens } from '@/core/design/token-parse';
import { scanSource, TokenRule } from '@/core/design/token-scan';

const rules = (source: string, file = 'src/site/x.tsx') =>
  scanSource(file, source).map((v) => v.rule);

describe('tokens:check scanner', () => {
  it('accepts token-based markup', () => {
    expect(
      rules('<h1 className="text-h1 text-foreground bg-surface py-section px-gutter">Hi</h1>'),
    ).toEqual([]);
    expect(rules("<div style={{ '--person-accent': person.accent } as CSSProperties} />")).toEqual(
      [],
    );
  });

  it('flags raw colors', () => {
    expect(rules('<p className="x" data-c="#ff0000" />')).toContain(TokenRule.ColorLiteral);
    expect(rules("const c = 'rgb(0 0 0)';")).toContain(TokenRule.ColorLiteral);
    expect(rules("const c = 'oklch(0.5 0.1 200)';")).toContain(TokenRule.ColorLiteral);
  });

  it('flags arbitrary Tailwind values', () => {
    for (const cls of [
      'text-[17px]',
      'bg-[#123456]',
      'tracking-[0.02em]',
      'leading-[1.3]',
      'p-[13px]',
      'md:w-[30rem]',
    ]) {
      expect(rules(`<div className="flex ${cls}" />`), cls).toContain(TokenRule.ArbitraryValue);
    }
  });

  it('flags arbitrary variants but not computed object keys', () => {
    expect(rules('<ul className="[&>li]:mt-2" />')).toContain(TokenRule.ArbitraryValue);
    expect(rules("  [Notice.Maintenance]: 'text',")).toEqual([]);
  });

  it('flags raw typography in CSS and inline styles', () => {
    expect(rules('.a { font-size: 17px; }', 'src/site/a.css')).toContain(TokenRule.TypographyValue);
    expect(rules('<p style={{ fontSize: 17 }} />')).toEqual(
      expect.arrayContaining([TokenRule.TypographyValue, TokenRule.InlineStyle]),
    );
    expect(rules('<p style={{ color: value }} />')).toContain(TokenRule.InlineStyle);
  });

  it('flags palette primitives in components', () => {
    expect(rules('<p className="text-brand-500" />')).toContain(TokenRule.PrimitiveColor);
    expect(rules('<p className="bg-blue-600" />')).toContain(TokenRule.PrimitiveColor);
    expect(rules('<p className="bg-white" />')).toContain(TokenRule.PrimitiveColor);
  });
});

describe('token parsing', () => {
  it('resolves var() references and groups text styles', () => {
    const raw = parseCustomProperties(`
      @theme { --color-brand-600: #2546ea; --color-primary: var(--color-brand-600); --color-*: initial; }
      :root { --type-h1-size: 3rem; --type-h1-weight: 800; }
    `);
    const tokens = groupTokens(resolveTokens(raw));
    expect(tokens.color.primary).toBe('#2546ea');
    expect(tokens.type.h1).toEqual({ size: '3rem', weight: '800' });
  });

  it('the generated module matches tokens.css', () => {
    const generated = fs.readFileSync('src/site/theme/tokens.generated.ts', 'utf8');
    const tokens = groupTokens(
      resolveTokens(parseCustomProperties(fs.readFileSync('src/site/theme/tokens.css', 'utf8'))),
    );
    expect(generated).toContain(JSON.stringify(tokens, null, 2));
  });
});
