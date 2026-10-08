/**
 * The ONLY place where the site's fonts are declared (docs/DESIGN_TOKENS.md).
 * Each font exposes a CSS variable that tokens.css maps to --font-heading /
 * --font-body / --font-mono. Self-hosted by next/font, subset, display: swap.
 */
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google';

const heading = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-family-heading',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-family-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-family-mono',
  display: 'swap',
  preload: false,
});

/** Class names that define the font variables; applied to <html>. */
export const fontVariables = [heading.variable, body.variable, mono.variable].join(' ');
