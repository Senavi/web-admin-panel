/**
 * Detects Tailwind utilities that reference a theme token which does not exist.
 * Tailwind's default scales are reset in tokens.css, so e.g. `text-sm`,
 * `shadow-xl` or `font-bold` silently produce no CSS. Pure; used by tokens:check.
 */

export interface TokenCatalog {
  readonly colors: ReadonlySet<string>;
  readonly fonts: ReadonlySet<string>;
  readonly radii: ReadonlySet<string>;
  readonly shadows: ReadonlySet<string>;
  readonly spacing: ReadonlySet<string>;
  readonly containers: ReadonlySet<string>;
  readonly aspects: ReadonlySet<string>;
  readonly eases: ReadonlySet<string>;
  /** Custom `@utility` class names (text-h1, border-thin, z-header…). */
  readonly utilities: ReadonlySet<string>;
}

export function buildCatalog(
  properties: ReadonlyMap<string, string>,
  utilities: readonly string[],
): TokenCatalog {
  const named = (prefix: string) =>
    new Set(
      [...properties.keys()]
        .filter((name) => name.startsWith(prefix) && !name.endsWith('-*'))
        .map((name) => name.slice(prefix.length)),
    );
  return {
    colors: named('--color-'),
    fonts: named('--font-'),
    radii: named('--radius-'),
    shadows: named('--shadow-'),
    spacing: named('--spacing-'),
    containers: named('--container-'),
    aspects: named('--aspect-'),
    eases: named('--ease-'),
    utilities: new Set(utilities),
  };
}

export function parseUtilityNames(css: string): string[] {
  return [...css.matchAll(/@utility\s+([\w-]+)/g)].map((match) => match[1] ?? '').filter(Boolean);
}

const GLOBAL = new Set(['inherit', 'current', 'transparent', 'initial']);
const TEXT_KEYWORDS = new Set([
  'left',
  'center',
  'right',
  'justify',
  'start',
  'end',
  'balance',
  'pretty',
  'wrap',
  'nowrap',
  'ellipsis',
  'clip',
]);
const BG_KEYWORDS = new Set([
  'none',
  'cover',
  'contain',
  'auto',
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'fixed',
  'local',
  'scroll',
  'repeat',
  'no-repeat',
  'repeat-x',
  'repeat-y',
]);
const BORDER_KEYWORDS = new Set([
  'solid',
  'dashed',
  'dotted',
  'double',
  'hidden',
  'none',
  'collapse',
  'separate',
  'x',
  'y',
  't',
  'b',
  'l',
  'r',
  's',
  'e',
]);
const SIZE_KEYWORDS = new Set([
  'auto',
  'full',
  'screen',
  'svh',
  'dvh',
  'lvh',
  'svw',
  'dvw',
  'min',
  'max',
  'fit',
  'px',
  'none',
]);
const NUMERIC = /^-?\d+(\.\d+)?$|^\d+\/\d+$/;

// Longest prefixes first so `gap-x-6` isn't read as `gap` + `x-6`.
const SPACING_PREFIXES = [
  'translate-x',
  'translate-y',
  'scroll-mt',
  'scroll-m',
  'scroll-p',
  'space-x',
  'space-y',
  'inset-x',
  'inset-y',
  'bottom',
  'gap-x',
  'gap-y',
  'min-w',
  'min-h',
  'max-h',
  'inset',
  'right',
  'start',
  'basis',
  'size',
  'left',
  'gap',
  'top',
  'end',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'ps',
  'pe',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'ms',
  'me',
  'p',
  'm',
  'w',
  'h',
];
const SPACING_PREFIX = new RegExp(`^(?:${SPACING_PREFIXES.join('|')})-(.+)$`);

/** Returns why a single utility class is invalid, or null if it is fine / not checked. */
export function unknownTokenReason(className: string, catalog: TokenCatalog): string | null {
  // Strip variants (`md:`, `hover:`, `data-[…]:`), important/negative markers and opacity modifiers.
  const base =
    className
      .split(':')
      .at(-1)
      ?.replace(/^!/, '')
      .replace(/^-/, '')
      .replace(/\/\d+$/, '') ?? '';
  if (!base || base.includes('[') || base.includes('(') || catalog.utilities.has(base)) return null;
  const value = (prefix: string) =>
    base.startsWith(`${prefix}-`) ? base.slice(prefix.length + 1) : null;

  const text = value('text');
  if (text !== null && !catalog.colors.has(text) && !TEXT_KEYWORDS.has(text) && !GLOBAL.has(text)) {
    return `no text style or color token "${text}"`;
  }
  const bg = value('bg');
  if (
    bg !== null &&
    !catalog.colors.has(bg) &&
    !BG_KEYWORDS.has(bg) &&
    !GLOBAL.has(bg) &&
    !/^(clip|origin|linear|radial|conic|blend)-/.test(bg)
  ) {
    return `no color token "${bg}"`;
  }
  for (const prefix of [
    'border',
    'outline',
    'ring',
    'divide',
    'fill',
    'stroke',
    'decoration',
    'accent',
    'caret',
  ]) {
    const color = value(prefix);
    if (color === null || NUMERIC.test(color) || GLOBAL.has(color) || BORDER_KEYWORDS.has(color))
      continue;
    const sideColor = color.replace(/^[xytblrse]-/, '');
    if (
      !catalog.colors.has(color) &&
      !catalog.colors.has(sideColor) &&
      !NUMERIC.test(sideColor) &&
      !/^(offset|inset|opacity)/.test(color)
    ) {
      return `no color token "${color}"`;
    }
  }
  if (base === 'shadow' || base === 'rounded')
    return `"${base}" has no default token (use a named size)`;
  const shadow = value('shadow');
  if (
    shadow !== null &&
    !catalog.shadows.has(shadow) &&
    shadow !== 'none' &&
    !catalog.colors.has(shadow)
  )
    return `no shadow token "${shadow}"`;
  const rounded = /^rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?-(.+)$/.exec(base)?.[1];
  if (rounded !== undefined && !catalog.radii.has(rounded) && rounded !== 'none')
    return `no radius token "${rounded}"`;
  const font = value('font');
  if (font !== null && !catalog.fonts.has(font))
    return `no font token "${font}" (weights live in text styles)`;
  if (base.startsWith('leading-') || base.startsWith('tracking-'))
    return 'line height / letter spacing belong to text-style utilities';
  const maxW = value('max-w');
  if (
    maxW !== null &&
    !catalog.containers.has(maxW) &&
    !SIZE_KEYWORDS.has(maxW) &&
    !NUMERIC.test(maxW)
  )
    return `no container token "${maxW}"`;
  const aspect = value('aspect');
  if (
    aspect !== null &&
    !catalog.aspects.has(aspect) &&
    !['auto', 'square', 'video'].includes(aspect)
  )
    return `no aspect token "${aspect}"`;
  const ease = value('ease');
  if (ease !== null && !catalog.eases.has(ease) && ease !== 'linear')
    return `no easing token "${ease}"`;
  const spacing = SPACING_PREFIX.exec(base)?.[1];
  if (
    spacing !== undefined &&
    !NUMERIC.test(spacing) &&
    !SIZE_KEYWORDS.has(spacing) &&
    !catalog.spacing.has(spacing) &&
    !catalog.containers.has(spacing)
  ) {
    return `no spacing token "${spacing}"`;
  }
  return null;
}

/** Candidate class strings: string literals that look like class lists. */
export function classTokens(source: string): Array<{ token: string; index: number }> {
  const result: Array<{ token: string; index: number }> = [];
  for (const match of source.matchAll(/(["'`])((?:(?!\1)[^\\\n])*)\1/g)) {
    const literal = match[2] ?? '';
    if (!/^[\w\s:/.!\-[\]()&@*%#=,>+~]+$/.test(literal) || /\s{2,}|^\s|\s$/.test(literal)) continue;
    const words = literal.split(/\s+/);
    // Only consider literals that contain at least one obvious utility.
    if (
      !words.some((word) =>
        /^(?:[\w-]+:)*-?(?:text|bg|p[xytblrse]?|m[xytblrse]?|gap|flex|grid|rounded|shadow|border|font|w|h|max-w|min-h|items|justify)(?:-|$)/.test(
          word,
        ),
      )
    )
      continue;
    let offset = (match.index ?? 0) + 1;
    for (const word of words) {
      result.push({ token: word, index: offset });
      offset += word.length + 1;
    }
  }
  return result;
}
