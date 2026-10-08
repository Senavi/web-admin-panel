import Link from 'next/link';
import { cacheLife } from 'next/cache';
import { getTranslations } from 'next-intl/server';

import { localizedPath } from '@/core/i18n/routing';

import { Container } from '../components/ui/layout';
import { Text } from '../components/ui/typography';
import { HEADER_NAV, pagePath } from '../navigation';

export async function SiteFooter({
  locale,
  defaultLocale,
  siteName,
}: {
  locale: string;
  defaultLocale: string;
  siteName: string;
}) {
  const t = await getTranslations('nav');
  const footer = await getTranslations('footer');
  const common = await getTranslations('common');
  const year = await currentYear();

  return (
    <footer className="border-thin border-t border-border bg-surface">
      <Container className="flex flex-col gap-6 py-section-tight md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <Text variant="label">{siteName}</Text>
          <Text variant="caption" tone="muted">
            © {year} {siteName}. {footer('rights')}
          </Text>
          <Text variant="caption" tone="muted">
            {footer('demoNotice')}
          </Text>
        </div>
        <nav aria-label={common('mainNavigation')}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {HEADER_NAV.map((item) => (
              <li key={item.pageId}>
                <Link
                  href={localizedPath(pagePath(item.pageId), locale, defaultLocale)}
                  className="text-body-sm text-muted-foreground hover:text-foreground"
                >
                  {t(item.messageKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </footer>
  );
}

/** Cached so the static shell can include it (refreshed daily). */
async function currentYear(): Promise<number> {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}
