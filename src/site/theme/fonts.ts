/**
 * The ONLY place where the site's fonts are declared (docs/DESIGN_TOKENS.md).
 * Each font exposes a CSS variable that tokens.css maps to --font-heading /
 * --font-body / --font-mono. Self-hosted by next/font, subset, display: swap.
 *
 * The demo uses one variable font (Inter) for headings and body: a single font
 * download keeps mobile LCP within budget. Use a different family for headings
 * by declaring it here and pointing --font-family-heading at it.
 */
import { Inter, JetBrains_Mono } from 'next/font/google';

const sans = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-family-body',
  display: 'swap',
  // Not preloaded: on slow mobile connections font preloads compete with the
  // LCP image. Text swaps in with size-adjusted fallbacks (no CLS).
  preload: false,
});

const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-family-mono',
  display: 'swap',
  preload: false,
});

/** Class names that define the font variables; applied to <html>. */
export const fontVariables = [sans.variable, mono.variable].join(' ');
