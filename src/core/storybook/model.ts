/**
 * Pure helpers behind `/storybook` (docs/CUSTOMIZING.md § Storybook): turn the
 * generated design tokens into what the page shows: contrast ratios, text
 * sizes resolved for a phone and a desktop viewport, grouped scales. No React,
 * no server code: unit-tested.
 */

/** Shape of `src/site/theme/tokens.generated.ts` (only what the storybook reads). */
export interface TextStyleToken {
  readonly size: string;
  readonly lineHeight: string;
  readonly letterSpacing: string;
  readonly weight: string;
  readonly family: string;
}

export interface StorybookTokens {
  readonly color: Readonly<Record<string, string>>;
  readonly font: Readonly<Record<string, string>>;
  readonly type: Readonly<Record<string, TextStyleToken>>;
  readonly spacing: Readonly<Record<string, string>>;
  readonly container?: Readonly<Record<string, string>>;
  readonly radius: Readonly<Record<string, string>>;
  readonly shadow: Readonly<Record<string, string>>;
}

/** Viewport widths (px) the text styles are resolved for. */
export const MOBILE_VIEWPORT = 375;
export const DESKTOP_VIEWPORT = 1280;
const ROOT_FONT_SIZE = 16;

// ── Colors ───────────────────────────────────────────────────────────────────

/** `#rgb` / `#rrggbb` → [r, g, b]; null for anything else (rgb() with alpha, var()…). */
export function parseHex(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  const hex = match?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex;
  return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio (1–21) of two hex colors, or null when either isn't a plain hex. */
export function contrastRatio(a: string, b: string): number | null {
  const first = parseHex(a);
  const second = parseHex(b);
  if (!first || !second) return null;
  const [light, dark] = [luminance(first), luminance(second)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

export type ContrastLevel = 'AAA' | 'AA' | 'AA large' | 'Fail';

/** WCAG level for normal text (large text passes AA from 3:1). */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'Fail';
}

/** Raw palette steps (`brand600`, `neutral50`, `red600`); everything else is semantic. */
const PRIMITIVE_COLOR = /^[a-z]+\d+$/;

export interface ColorSwatch {
  readonly name: string;
  readonly value: string;
  /** Contrast against the page background / foreground tokens; null when not a plain hex. */
  readonly onBackground: number | null;
  readonly onForeground: number | null;
}

export interface ColorGroups {
  readonly semantic: readonly ColorSwatch[];
  readonly palette: readonly ColorSwatch[];
}

export function colorGroups(colors: Readonly<Record<string, string>>): ColorGroups {
  const background = colors.background ?? '#ffffff';
  const foreground = colors.foreground ?? '#000000';
  const swatch = ([name, value]: [string, string]): ColorSwatch => ({
    name,
    value,
    onBackground: contrastRatio(value, background),
    onForeground: contrastRatio(value, foreground),
  });
  const entries = Object.entries(colors);
  return {
    semantic: entries.filter(([name]) => !PRIMITIVE_COLOR.test(name)).map(swatch),
    palette: entries.filter(([name]) => PRIMITIVE_COLOR.test(name)).map(swatch),
  };
}

// ── Lengths and text styles ──────────────────────────────────────────────────

/**
 * Evaluates a token length (`1rem`, `16px`, `clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)`,
 * `clamp(1rem, 4vw, 2rem)`) in px for a viewport width; null when it isn't one of those.
 */
export function evalLength(value: string, viewport: number): number | null {
  const sum = (expression: string): number | null => {
    let total = 0;
    let found = false;
    let rest = expression.trim();
    while (rest.length > 0) {
      const term = /^([+-]?)\s*(\d*\.?\d+)(rem|em|px|vw)\s*/.exec(rest);
      if (!term) return null;
      const [whole, sign, amount, unit] = term;
      const number = Number(amount) * (sign === '-' ? -1 : 1);
      total +=
        unit === 'px'
          ? number
          : unit === 'vw'
            ? (number * viewport) / 100
            : number * ROOT_FONT_SIZE;
      found = true;
      rest = rest.slice(whole.length);
    }
    return found ? total : null;
  };
  const clamp = /^clamp\((.+)\)$/.exec(value.trim());
  if (!clamp?.[1]) return sum(value);
  const [min, preferred, max] = clamp[1].split(',').map((part) => sum(part));
  if (min === undefined || preferred === undefined || max === undefined) return null;
  if (min === null || preferred === null || max === null) return null;
  return Math.min(Math.max(preferred, min), max);
}

export interface ResolvedTextStyle {
  readonly name: string;
  readonly weight: string;
  readonly family: string;
  /** Font size in px at the phone and desktop viewport. */
  readonly sizePx: { readonly mobile: number | null; readonly desktop: number | null };
  /** Line height in px (unitless line heights multiply the size). */
  readonly lineHeightPx: { readonly mobile: number | null; readonly desktop: number | null };
  /** Letter spacing as written (em) and in px. */
  readonly letterSpacing: string;
  readonly letterSpacingPx: { readonly mobile: number | null; readonly desktop: number | null };
}

const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);

export function resolveTextStyle(name: string, style: TextStyleToken): ResolvedTextStyle {
  const at = (viewport: number) => {
    const size = evalLength(style.size, viewport);
    const lineHeight = Number(style.lineHeight);
    const spacing = /^(-?\d*\.?\d+)em$/.exec(style.letterSpacing);
    return {
      size: round(size),
      lineHeight: round(size !== null && Number.isFinite(lineHeight) ? size * lineHeight : null),
      spacing: round(
        size !== null && spacing?.[1] ? size * Number(spacing[1]) : size === null ? null : 0,
      ),
    };
  };
  const mobile = at(MOBILE_VIEWPORT);
  const desktop = at(DESKTOP_VIEWPORT);
  return {
    name,
    weight: style.weight,
    family: style.family,
    sizePx: { mobile: mobile.size, desktop: desktop.size },
    lineHeightPx: { mobile: mobile.lineHeight, desktop: desktop.lineHeight },
    letterSpacing: style.letterSpacing,
    letterSpacingPx: { mobile: mobile.spacing, desktop: desktop.spacing },
  };
}

/** Text styles in token order (display, h1–h6, lead, body variants, caption, label…). */
export function textStyles(tokens: StorybookTokens): ResolvedTextStyle[] {
  return Object.entries(tokens.type).map(([name, style]) => resolveTextStyle(name, style));
}

/** "bodyLg" → "body-lg" (the name of the CSS utility `text-body-lg`). */
export function utilityName(name: string): string {
  return `text-${name.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/** The family stack as a readable string (generated tokens can carry stray parentheses). */
export function cleanFamily(family: string): string {
  return family.replace(/\)\)/g, ')');
}

export function formatPx(value: number | null): string {
  return value === null ? '—' : `${Number.isInteger(value) ? value : value.toFixed(1)}px`;
}

/** Sections shown by `/storybook` for the tokens (ids are anchors). */
export const TOKEN_SECTIONS = [
  { id: 'colors', title: 'Colors' },
  { id: 'fonts', title: 'Fonts' },
  { id: 'text-styles', title: 'Text styles' },
  { id: 'spacing', title: 'Spacing' },
  { id: 'radii', title: 'Radii' },
  { id: 'shadows', title: 'Shadows' },
] as const;
