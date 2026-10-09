import Link from 'next/link';
import { cacheLife } from 'next/cache';
import { getTranslations } from 'next-intl/server';

import { mailtoHref, telHref } from '@/core/content/contact-links';
import { getGlobalContent } from '@/core/content/loader';
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
  const [year, site] = await Promise.all([currentYear(), getGlobalContent('site', locale)]);
  const { contacts, social, legal } = site;

  return (
    <footer className="border-thin border-t border-border bg-surface">
      <Container className="flex flex-col gap-6 py-section-tight md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <Text variant="label">{siteName}</Text>
          <Text variant="caption" tone="muted">
            © {year} {siteName}. {footer('rights')}
          </Text>
          {legal.line ? (
            <Text variant="caption" tone="muted">
              {legal.line}
            </Text>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Text variant="label">{footer('contact')}</Text>
          {contacts.phone ? (
            <a href={telHref(contacts.phone)} className="text-body-sm hover:text-primary">
              {contacts.phone}
            </a>
          ) : null}
          {contacts.email ? (
            <a href={mailtoHref(contacts.email)} className="text-body-sm hover:text-primary">
              {contacts.email}
            </a>
          ) : null}
          {contacts.address ? (
            <address className="text-body-sm whitespace-pre-line text-muted-foreground not-italic">
              {contacts.address}
            </address>
          ) : null}
        </div>
        {social.links.length > 0 ? (
          <nav aria-label={footer('follow')} className="flex flex-col gap-2">
            <Text variant="label">{footer('follow')}</Text>
            <ul className="flex flex-col gap-1">
              {social.links.map((item) => (
                <li key={item._key}>
                  <a
                    href={item.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body-sm text-muted-foreground hover:text-foreground"
                  >
                    {item.link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
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
