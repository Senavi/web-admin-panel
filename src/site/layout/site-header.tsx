import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { localeInfo } from '@/core/i18n/locales';
import { localizedPath } from '@/core/i18n/routing';
import type { SiteLogo } from '@/core/media/branding';

import { Container } from '../components/ui/layout';
import { HEADER_NAV, pagePath } from '../navigation';
import { LanguageSwitcher } from './language-switcher';

export async function SiteHeader({
  locale,
  defaultLocale,
  enabledLocales,
  siteName,
  logo,
}: {
  locale: string;
  defaultLocale: string;
  enabledLocales: readonly string[];
  siteName: string;
  logo: SiteLogo | null;
}) {
  const t = await getTranslations('nav');
  const common = await getTranslations('common');
  const href = (pageId: string) => localizedPath(pagePath(pageId), locale, defaultLocale);
  const links = HEADER_NAV.map((item) => ({ href: href(item.pageId), label: t(item.messageKey) }));
  const switcher = (
    <LanguageSwitcher
      locales={enabledLocales.map((code) => ({ code, label: localeInfo(code).label }))}
      current={locale}
      defaultLocale={defaultLocale}
      label={common('language')}
    />
  );

  return (
    <header className="sticky top-0 z-header border-thin border-b border-border bg-background">
      <Container className="flex min-h-16 items-center justify-between gap-6">
        <Link href={href('home')} className="text-h5 text-foreground">
          {logo ? (
            <Image
              src={logo.src}
              alt={siteName}
              width={logo.width || 160}
              height={logo.height || 40}
              // SVG logos are served as-is (sanitized on upload); rasters are optimized.
              unoptimized={logo.isSvg}
              priority
              className="h-8 w-auto"
            />
          ) : (
            siteName
          )}
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <nav aria-label={common('mainNavigation')}>
            <ul className="flex items-center gap-6">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-nav text-muted-foreground transition-colors duration-fast hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {switcher}
        </div>

        {/* Mobile menu without JavaScript. */}
        <details className="group md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border-thin border-border px-4 text-label">
            {common('menu')}
          </summary>
          <div className="absolute inset-x-0 top-full border-thin border-b border-border bg-background">
            <Container className="flex flex-col gap-4 py-6">
              <nav aria-label={common('mainNavigation')}>
                <ul className="flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-h5 text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              {switcher}
            </Container>
          </div>
        </details>
      </Container>
    </header>
  );
}
