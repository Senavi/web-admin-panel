/**
 * PROJECT: root layout of `/storybook` (staff only; not localized, so it is its own root
 * layout beside `[locale]`). Loads the site stylesheet and fonts: it shows the real look.
 */
import '@/site/theme/site.css';

import type { Metadata } from 'next';

import { fontVariables } from '@/site/theme/fonts';

export const metadata: Metadata = {
  title: 'Storybook',
  robots: { index: false, follow: false, nocache: true },
};

export default function StorybookRootLayout({ children }: LayoutProps<'/storybook'>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
