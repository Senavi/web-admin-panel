import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/** Shared chrome of every public page: skip link, header, main, footer. */
export async function SiteLayout({
  locale,
  defaultLocale,
  enabledLocales,
  siteName,
  children,
}: {
  locale: string;
  defaultLocale: string;
  enabledLocales: readonly string[];
  siteName: string;
  children: ReactNode;
}) {
  const t = await getTranslations('common');
  return (
    <>
      <a
        href="#main"
        className="sr-only z-skip-link rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {t('skipToContent')}
      </a>
      <SiteHeader
        locale={locale}
        defaultLocale={defaultLocale}
        enabledLocales={enabledLocales}
        siteName={siteName}
      />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter locale={locale} defaultLocale={defaultLocale} siteName={siteName} />
    </>
  );
}
