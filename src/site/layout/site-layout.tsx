import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import type { SiteLogo } from '@/core/media/branding';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/** Shared chrome of every public page: skip link, header, main, footer. */
export async function SiteLayout({
  locale,
  defaultLocale,
  enabledLocales,
  siteName,
  logo,
  children,
}: {
  locale: string;
  defaultLocale: string;
  enabledLocales: readonly string[];
  siteName: string;
  logo: SiteLogo | null;
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
        logo={logo}
      />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter locale={locale} defaultLocale={defaultLocale} siteName={siteName} />
    </>
  );
}
