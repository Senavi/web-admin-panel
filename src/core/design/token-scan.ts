/**
 * Rules behind `pnpm tokens:check`: site components must use semantic tokens
 * and text-style utilities from `src/site/theme`, never raw visual values.
 * Pure functions so they can be unit-tested.
 */

export interface TokenViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: TokenRule;
  readonly excerpt: string;
}

export const TokenRule = {
  ColorLiteral: 'color-literal',
  ArbitraryValue: 'arbitrary-tailwind-value',
  TypographyValue: 'raw-typography-value',
  InlineStyle: 'inline-visual-style',
  PrimitiveColor: 'primitive-color-class',
} as const;
export type TokenRule = (typeof TokenRule)[keyof typeof TokenRule];

export const TOKEN_RULE_HELP: Record<TokenRule, string> = {
  [TokenRule.ColorLiteral]:
    'Use a semantic color token (e.g. text-foreground, bg-primary) instead of a raw color.',
  [TokenRule.ArbitraryValue]:
    'Arbitrary Tailwind values are not allowed. Add a token to src/site/theme/tokens.css.',
  [TokenRule.TypographyValue]:
    'Use a text-style utility (text-h1, text-body…) instead of raw font sizes/line heights/letter spacing.',
  [TokenRule.InlineStyle]:
    'Inline styles may only set CSS custom properties (e.g. style={{ "--accent": value }}).',
  [TokenRule.PrimitiveColor]:
    'Components use semantic colors only (primary, surface…), not palette primitives.',
};

const COLOR_LITERAL =
  /(?<![\w&-])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/i;
// `text-[17px]`, `bg-[#123]`, `p-[13px]`, `[&>p]:mt-2`, `md:w-[30rem]`
const ARBITRARY_VALUE = /(?:^|[\s"'`{(:])!?-?[a-z][\w-]*-\[[^\]\s]+\]|(?:^|[\s"'`{])\[[^\]\s]+\]:/;
const CSS_TYPOGRAPHY = /\b(?:font-size|line-height|letter-spacing)\s*:/i;
const JS_TYPOGRAPHY = /\b(?:fontSize|lineHeight|letterSpacing)\s*:/;
const INLINE_STYLE = /style=\{\{([^}]*)\}\}/g;
const STYLE_PROPERTY = /(?:^|,)\s*(['"]?)([\w-]+)\1\s*:/g;
const PRIMITIVE_CLASS =
  /\b(?:text|bg|border|ring|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow)-(?:brand|neutral|green|amber|red|white|black|slate|gray|zinc|stone|orange|yellow|lime|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/;

export function scanSource(file: string, source: string): TokenViolation[] {
  const violations: TokenViolation[] = [];
  const isCss = file.endsWith('.css');
  const lines = source.split('\n');

  lines.forEach((text, index) => {
    const line = index + 1;
    const trimmed = text.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    const push = (rule: TokenRule) =>
      violations.push({ file, line, rule, excerpt: trimmed.slice(0, 160) });

    if (COLOR_LITERAL.test(text)) push(TokenRule.ColorLiteral);
    if (!isCss && ARBITRARY_VALUE.test(text)) push(TokenRule.ArbitraryValue);
    if (isCss ? CSS_TYPOGRAPHY.test(text) : JS_TYPOGRAPHY.test(text))
      push(TokenRule.TypographyValue);
    if (!isCss && PRIMITIVE_CLASS.test(text)) push(TokenRule.PrimitiveColor);
  });

  if (!isCss) {
    for (const match of source.matchAll(INLINE_STYLE)) {
      const body = match[1] ?? '';
      const keys = [...body.matchAll(STYLE_PROPERTY)].map((property) => property[2] ?? '');
      if (keys.some((key) => !key.startsWith('--'))) {
        const line = source.slice(0, match.index).split('\n').length;
        violations.push({
          file,
          line,
          rule: TokenRule.InlineStyle,
          excerpt: match[0].slice(0, 160),
        });
      }
    }
  }
  return violations;
}
